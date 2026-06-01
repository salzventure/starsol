'use strict';
// Google Play Billing — RTDN handler + purchase verification for Android TV.
//
// Security posture:
// - Disabled unless PLAY_BILLING_ENABLED=1 and service-account credentials exist.
// - Never grants a plan from a client-supplied purchase token alone.
// - Stores a SHA-256 token hash, not the raw Play purchase token.

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const store = require('./store');

const PACKAGE_NAME = process.env.PLAY_PACKAGE_NAME || 'app.starsol.tv';
const PLAY_ENABLED = process.env.PLAY_BILLING_ENABLED === '1';
const RTDN_AUDIENCE = process.env.PLAY_RTDN_AUDIENCE
    || process.env.APP_URL
    || 'https://starsol.app';
const RTDN_ALLOWED_EMAIL = process.env.PLAY_RTDN_SERVICE_ACCOUNT_EMAIL || null;

const PRODUCT_PLANS = {
    explorer_monthly: 'explorer',
    explorer_annual:  'explorer',
    observer_monthly: 'observer',
    observer_annual:  'observer',
};
const PLAN_ORDER = ['free', 'explorer', 'observer', 'institutional'];
const ENTITLED_STATUSES = ['active', 'trialing', 'in_grace_period'];

let cachedAccessToken = null;
let cachedAccessTokenExpiresAt = 0;

function playConfig() {
    if (!PLAY_ENABLED) return { ok: false, error: 'play_billing_disabled' };
    if (!process.env.PLAY_SERVICE_ACCOUNT_JSON) return { ok: false, error: 'play_credentials_missing' };
    return { ok: true };
}

function parseServiceAccount() {
    const raw = process.env.PLAY_SERVICE_ACCOUNT_JSON;
    if (!raw) return null;
    return JSON.parse(raw);
}

function tokenHash(purchaseToken) {
    return crypto.createHash('sha256').update(String(purchaseToken)).digest('hex');
}

function tokenLast4(purchaseToken) {
    return String(purchaseToken).slice(-4);
}

function planFromProduct(productId) {
    return PRODUCT_PLANS[String(productId || '').toLowerCase()] || null;
}

function statusFromPlay(subscription) {
    const state = subscription?.subscriptionState || '';
    if (state === 'SUBSCRIPTION_STATE_ACTIVE') return 'active';
    if (state === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD') return 'in_grace_period';
    if (state === 'SUBSCRIPTION_STATE_ON_HOLD') return 'on_hold';
    if (state === 'SUBSCRIPTION_STATE_PAUSED') return 'paused';
    if (state === 'SUBSCRIPTION_STATE_CANCELED') return 'canceled';
    if (state === 'SUBSCRIPTION_STATE_EXPIRED') return 'expired';
    return state ? state.toLowerCase() : 'unknown';
}

function entitlementFromStatus(status) {
    return ENTITLED_STATUSES.includes(status);
}

function betterPlan(a, b) {
    return PLAN_ORDER.indexOf(b || 'free') > PLAN_ORDER.indexOf(a || 'free') ? b : a;
}

async function effectivePlanForUser(userId) {
    let plan = 'free';
    const stripeRows = await store.query(
        'SELECT plan FROM subscriptions WHERE user_id = ? AND status IN ("active","trialing")',
        [userId],
    );
    for (const row of stripeRows) plan = betterPlan(plan, row.plan);
    const playRows = await store.query(
        'SELECT plan FROM play_subscriptions WHERE user_id = ? AND status IN ("active","in_grace_period") AND (expiry_ms IS NULL OR expiry_ms > ?)',
        [userId, Date.now()],
    );
    for (const row of playRows) plan = betterPlan(plan, row.plan);
    return plan;
}

async function syncEffectivePlan(userId) {
    const plan = await effectivePlanForUser(userId);
    await store.users.updatePlan(userId, plan);
    return plan;
}

function lineItemFromSubscription(subscription, fallbackProductId) {
    const items = Array.isArray(subscription?.lineItems) ? subscription.lineItems : [];
    return items.find(item => item.productId === fallbackProductId) || items[0] || {};
}

function expiryMsFromLineItem(lineItem) {
    const time = lineItem?.expiryTime;
    if (!time) return null;
    const ms = Date.parse(time);
    return Number.isFinite(ms) ? ms : null;
}

function autoRenewingFromLineItem(lineItem) {
    return lineItem?.autoRenewingPlan ? 1 : 0;
}

async function getPlayAccessToken() {
    const now = Date.now();
    if (cachedAccessToken && cachedAccessTokenExpiresAt > now + 60_000) return cachedAccessToken;

    const account = parseServiceAccount();
    if (!account?.client_email || !account?.private_key) {
        throw new Error('invalid_play_service_account');
    }

    const iat = Math.floor(now / 1000);
    const assertion = jwt.sign({
        iss: account.client_email,
        scope: 'https://www.googleapis.com/auth/androidpublisher',
        aud: 'https://oauth2.googleapis.com/token',
        iat,
        exp: iat + 3600,
    }, account.private_key, { algorithm: 'RS256' });

    const resp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion,
        }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.access_token) {
        throw new Error(`play_oauth_failed:${resp.status}`);
    }
    cachedAccessToken = data.access_token;
    cachedAccessTokenExpiresAt = now + Math.max(60, Number(data.expires_in || 3600) - 60) * 1000;
    return cachedAccessToken;
}

async function fetchPlaySubscription(purchaseToken) {
    const accessToken = await getPlayAccessToken();
    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(PACKAGE_NAME)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
        const reason = data?.error?.status || data?.error?.message || `http_${resp.status}`;
        throw new Error(`play_subscription_lookup_failed:${reason}`);
    }
    return data;
}

async function upsertPlaySubscription({ userId, purchaseToken, productId, subscription }) {
    const lineItem = lineItemFromSubscription(subscription, productId);
    const resolvedProductId = lineItem.productId || productId;
    const plan = planFromProduct(resolvedProductId);
    if (!plan) throw new Error('unknown_play_product');

    const status = statusFromPlay(subscription);
    const expiryMs = expiryMsFromLineItem(lineItem);
    const now = Date.now();

    await store.execute(
        `INSERT INTO play_subscriptions
           (user_id, package_name, subscription_id, purchase_token_hash, purchase_token_last4,
            plan, status, expiry_ms, auto_renewing, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           user_id = VALUES(user_id),
           package_name = VALUES(package_name),
           subscription_id = VALUES(subscription_id),
           purchase_token_last4 = VALUES(purchase_token_last4),
           plan = VALUES(plan),
           status = VALUES(status),
           expiry_ms = VALUES(expiry_ms),
           auto_renewing = VALUES(auto_renewing),
           updated_at = VALUES(updated_at)`,
        [
            userId,
            PACKAGE_NAME,
            resolvedProductId,
            tokenHash(purchaseToken),
            tokenLast4(purchaseToken),
            plan,
            status,
            expiryMs,
            autoRenewingFromLineItem(lineItem),
            now,
            now,
        ],
    );

    const effectivePlan = await syncEffectivePlan(userId);
    return { plan: effectivePlan, sourcePlan: plan, status, expiryMs };
}

async function verifyPubsubPush(req) {
    if (!PLAY_ENABLED) return; // short-circuit if disabled
    let OAuth2Client;
    try {
        ({ OAuth2Client } = require('google-auth-library'));
    } catch (e) {
        console.error('[play] google-auth-library not installed — RTDN verification skipped');
        throw new Error('rtdn_verification_unavailable');
    }

    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
        throw new Error('missing_bearer');
    }
    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) throw new Error('missing_bearer');

    const client = new OAuth2Client();
    const ticket = await client.verifyIdToken({
        idToken: token,
        audience: RTDN_AUDIENCE,
    });
    const payload = ticket.getPayload();
    if (!payload?.email_verified) {
        throw new Error('email_unverified');
    }
    if (RTDN_ALLOWED_EMAIL && payload.email !== RTDN_ALLOWED_EMAIL) {
        throw new Error('unauthorized_publisher');
    }
    return payload;
}

async function handleRtdn(req, res) {
    const cfg = playConfig();
    if (!cfg.ok) return res.status(503).json({ error: cfg.error });
    try {
        try {
            await verifyPubsubPush(req);
        } catch (verifyErr) {
            console.warn('[play_billing/rtdn] auth rejected:', verifyErr.message);
            return res.status(401).json({ error: 'invalid_pubsub_token' });
        }

        const message = req.body?.message;
        if (!message?.data) return res.status(400).json({ error: 'missing_message_data' });

        const decoded = JSON.parse(Buffer.from(message.data, 'base64').toString('utf8'));
        const note = decoded.subscriptionNotification;
        if (!note?.purchaseToken) return res.json({ ok: true });

        const row = await store.queryOne(
            'SELECT user_id, subscription_id FROM play_subscriptions WHERE purchase_token_hash = ?',
            [tokenHash(note.purchaseToken)],
        );
        if (!row?.user_id) {
            console.warn('[play_billing] RTDN for unknown purchase token hash:', tokenHash(note.purchaseToken).slice(0, 12));
            return res.json({ ok: true });
        }

        const subscription = await fetchPlaySubscription(note.purchaseToken);
        const productId = note.subscriptionId || row.subscription_id;
        const result = await upsertPlaySubscription({
            userId: row.user_id,
            purchaseToken: note.purchaseToken,
            productId,
            subscription,
        });
        res.json({ ok: true, ...result });
    } catch (err) {
        console.error('[play_billing/rtdn]', err.message);
        res.status(500).json({ error: 'handler_error' });
    }
}

async function handleVerify(req, res) {
    const cfg = playConfig();
    if (!cfg.ok) return res.status(503).json({ error: cfg.error });
    try {
        const { purchaseToken, productId } = req.body || {};
        if (!purchaseToken || !productId) {
            return res.status(400).json({ error: 'missing_fields' });
        }
        if (!planFromProduct(productId)) {
            return res.status(400).json({ error: 'unknown_play_product' });
        }

        const subscription = await fetchPlaySubscription(purchaseToken);

        // Dedup: reject if this purchase token is already claimed by a different user.
        const hash = tokenHash(purchaseToken);
        const existingRow = await store.queryOne(
            'SELECT user_id FROM play_subscriptions WHERE purchase_token_hash = ?',
            [hash],
        );
        if (existingRow && existingRow.user_id !== req.user.id) {
            return res.status(409).json({ error: 'token_already_claimed' });
        }

        const result = await upsertPlaySubscription({
            userId: req.user.id,
            purchaseToken,
            productId,
            subscription,
        });
        res.json({ ok: true, ...result });
    } catch (err) {
        console.error('[play_billing/verify]', err.message);
        res.status(500).json({ error: 'handler_error' });
    }
}

module.exports = { handleRtdn, handleVerify, effectivePlanForUser, syncEffectivePlan, entitlementFromStatus };
