'use strict';

const express = require('express');
const router = express.Router();
const crypto = require('crypto');

const store = require('./store');
const email = require('./email');
const emailTemplates = require('./email_templates');
const { issueToken, hashPassword, verifyPassword, authMiddleware, requirePlan } = require('./auth');
const billing = require('./billing');
const admin = require('./admin');
const oauth = require('./oauth');
const siwa  = require('./siwa');
const observer = require('./observer');
const playBilling = require('./play_billing');

const FREE_WINDOW_MS = 2 * 24 * 60 * 60 * 1000; // 2 days before requiring account
const PLAN_ORDER = ['free', 'explorer', 'observer', 'institutional'];

function formatPeriodEnd(ts) {
    if (!ts) return null;
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function presentSubscription(sub) {
    if (!sub) return null;
    const priceDisplayMap = {
        explorer_annual: '$39.99 / yr',
        explorer_monthly: '$4.99 / mo',
        observer_annual: '$64.99 / yr',
        observer_monthly: '$7.99 / mo',
    };
    const priceKey = sub.stripe_price_id || '';
    const interval = priceKey.includes('annual') ? 'annual'
        : priceKey.includes('monthly') ? 'monthly'
        : null;
    return {
        ...sub,
        interval,
        priceDisplay: priceDisplayMap[priceKey] || null,
        periodEnd: formatPeriodEnd(sub.current_period_end),
    };
}

function presentPlaySubscription(sub) {
    if (!sub) return null;
    const priceDisplayMap = {
        explorer_annual: '$39.99 / yr',
        explorer_monthly: '$4.99 / mo',
        observer_annual: '$64.99 / yr',
        observer_monthly: '$7.99 / mo',
    };
    const key = sub.subscription_id || '';
    const interval = key.includes('annual') ? 'annual'
        : key.includes('monthly') ? 'monthly'
        : null;
    return {
        source: 'google_play',
        plan: sub.plan,
        status: sub.status,
        interval,
        subscription_id: sub.subscription_id,
        priceDisplay: priceDisplayMap[key] || null,
        periodEnd: formatPeriodEnd(sub.expiry_ms),
        autoRenewing: !!sub.auto_renewing,
    };
}

async function activePlaySubscriptionForUser(userId) {
    const rows = await store.query(
        `SELECT * FROM play_subscriptions
         WHERE user_id = ?
           AND status IN ("active","in_grace_period")
           AND (expiry_ms IS NULL OR expiry_ms > ?)
         ORDER BY FIELD(plan, "observer", "explorer") ASC, COALESCE(expiry_ms, 9999999999999) DESC
         LIMIT 1`,
        [userId, Date.now()],
    );
    return rows[0] || null;
}

// ── Auth ─────────────────────────────────────────────────────────────────

router.post('/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!email || !password || password.length < 8) {
            return res.status(400).json({ error: 'invalid_input' });
        }
        const existing = await store.users.findByEmail(email);
        if (existing) return res.status(409).json({ error: 'email_taken' });

        const passwordHash = await hashPassword(password);
        const user = await store.users.create({ name: name || null, email, passwordHash });
        const token = issueToken(user);
        store.events.log({ userId: user.id, type: 'auth', event: 'register' });
        res.json({ token, user: safeUser(user) });
    } catch (err) {
        console.error('/auth/register', err);
        res.status(500).json({ error: 'server_error' });
    }
});

router.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await store.users.findByEmail(email);
        if (!user) return res.status(401).json({ error: 'invalid_credentials' });
        if (!user.password_hash) return res.status(401).json({ error: 'password_login_unavailable' });

        if (user.locked_until && user.locked_until > Date.now()) {
            return res.status(429).json({ error: 'account_locked', retry_after: user.locked_until });
        }

        const ok = await verifyPassword(password, user.password_hash);
        if (!ok) {
            await store.users.incrementLoginAttempts(user.id);
            return res.status(401).json({ error: 'invalid_credentials' });
        }

        await store.users.resetLoginAttempts(user.id);
        await store.users.recordLogin(user.id);
        const token = issueToken(user);
        store.events.log({ userId: user.id, type: 'auth', event: 'login' });
        res.json({ token, user: safeUser(user) });
    } catch (err) {
        console.error('/auth/login', err);
        res.status(500).json({ error: 'server_error' });
    }
});

router.get('/auth/me', authMiddleware, async (req, res) => {
    const sub = await store.subscriptions.findByUserId(req.user.id);
    const playSub = await activePlaySubscriptionForUser(req.user.id);
    res.json({
        user: safeUser(req.user),
        subscription: presentSubscription(sub) || presentPlaySubscription(playSub),
        stripeSubscription: presentSubscription(sub),
        playSubscription: presentPlaySubscription(playSub),
    });
});

router.post('/auth/google', async (req, res) => {
    const { credential } = req.body || {};
    if (!credential) return res.status(400).json({ error: 'missing_credential' });
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) return res.status(503).json({ error: 'google_oauth_not_configured' });
    try {
        const gRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
        if (!gRes.ok) return res.status(401).json({ error: 'invalid_google_token' });
        const payload = await gRes.json();
        if (payload.aud !== clientId) return res.status(401).json({ error: 'token_audience_mismatch' });
        if (!payload.email_verified) return res.status(401).json({ error: 'email_not_verified' });

        const addr = payload.email.toLowerCase();
        const name = payload.name || payload.given_name || null;

        let user = await store.users.findByEmail(addr);
        if (!user) {
            user = await store.users.create({ name, email: addr, passwordHash: null });
            store.events.log({ userId: user.id, type: 'auth', event: 'google_register' });
        } else {
            await store.users.recordLogin(user.id);
            store.events.log({ userId: user.id, type: 'auth', event: 'google_login' });
        }

        const token = issueToken(user);
        res.json({ token, user: safeUser(user) });
    } catch (err) {
        console.error('/auth/google', err);
        res.status(500).json({ error: 'server_error' });
    }
});

// ── Forgot password ───────────────────────────────────────────────────────────
router.post('/auth/forgot', async (req, res) => {
    const { email: addr } = req.body || {};
    if (!addr) return res.status(400).json({ error: 'missing_email' });
    // Always return 200 — never reveal whether an email exists
    res.json({ ok: true });
    try {
        const user = await store.users.findByEmail(addr.toLowerCase().trim());
        if (!user) return;
        const token = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        await store.passwordResets.clearForUser(user.id);
        await store.passwordResets.create(user.id, tokenHash, Date.now() + 60 * 60 * 1000);
        await emailTemplates.sendPasswordReset(user, token);
        store.events.log({ userId: user.id, type: 'auth', event: 'password_reset_requested' });
    } catch (err) {
        console.error('/auth/forgot', err);
    }
});

router.post('/auth/reset', async (req, res) => {
    const { token, password } = req.body || {};
    if (!token || !password || password.length < 8) {
        return res.status(400).json({ error: 'invalid_request' });
    }
    try {
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const reset = await store.passwordResets.findValid(tokenHash);
        if (!reset) return res.status(400).json({ error: 'token_invalid_or_expired' });
        const newHash = await hashPassword(password);
        await store.users.setPasswordHash(reset.user_id, newHash);
        await store.passwordResets.markUsed(reset.id);
        await store.users.incrementSessionVersion(reset.user_id);
        const user = await store.users.findById(reset.user_id);
        const authToken = issueToken(user);
        store.events.log({ userId: user.id, type: 'auth', event: 'password_reset_completed' });
        res.json({ ok: true, token: authToken });
    } catch (err) {
        console.error('/auth/reset', err);
        res.status(500).json({ error: 'server_error' });
    }
});

// ── Auth config ───────────────────────────────────────────────────────────────
router.get('/auth/config', (req, res) => {
    res.json({ google: oauth.googleConfigured(), apple: oauth.appleConfigured() });
});

// ── Sign In with Apple — native tvOS credential flow ─────────────────────────
router.post('/auth/siwa', siwa.handler);

// ── Apple OAuth — web redirect flow ──────────────────────────────────────────
router.get('/auth/oauth/apple/start', async (req, res) => {
    if (!oauth.appleConfigured()) {
        return res.status(501).json({ error: 'Apple sign-in is not configured on this server.' });
    }
    const rawNext = (req.query.next || '').toString();
    const next = (rawNext.startsWith('/') && !rawNext.startsWith('//')) ? rawNext : '/account';
    const state = oauth.signState({ provider: 'apple', next });
    res.redirect(302, oauth.appleAuthUrl({ state }));
});

router.post('/auth/oauth/apple/callback', async (req, res) => {
    const code  = (req.body?.code  || '').toString();
    const state = (req.body?.state || '').toString();
    const sendError = (msg) => res.redirect(302, `/account?oauth_error=${encodeURIComponent(msg)}`);

    const decoded = oauth.verifyState(state);
    if (!decoded || decoded.provider !== 'apple') return sendError('invalid state');
    if (!code) return sendError('missing code');

    try {
        const profile = await oauth.appleExchange(code);
        // Apple sends the user's name only on the very first authorization
        // via the form-post body as a JSON string.
        if (!profile.name && req.body?.user) {
            try {
                const appleUser = JSON.parse(req.body.user);
                const fn = appleUser?.name?.firstName || '';
                const ln = appleUser?.name?.lastName  || '';
                profile.name = [fn, ln].filter(Boolean).join(' ') || null;
            } catch (_) {}
        }
        const { user, created, linked } = await oauth.resolveUserForOauth({ provider: 'apple', profile });
        store.execute('INSERT INTO events (user_id, type, event, ts) VALUES (?,?,?,?)',
            [user.id, 'auth', created ? 'apple_register' : 'apple_login', Date.now()]).catch(() => {});
        const token = issueToken(user);
        const safeNext = (decoded.next && decoded.next.startsWith('/') && !decoded.next.startsWith('//'))
            ? decoded.next : '/account';
        res.set('Cache-Control', 'no-store');
        res.send(`<!doctype html><meta charset=utf-8><title>Signing in…</title>
<body style="font-family:sans-serif;background:#050608;color:#fbf3df;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
  <div style="text-align:center">
    <div style="font-size:18px;font-weight:600;margin-bottom:8px">Signing you in…</div>
    <div style="font-size:13px;color:#c8b886">If this hangs, <a href="/account" style="color:#d4a44a">click here</a>.</div>
  </div>
  <script>
    try {
      localStorage.setItem('ss-token', ${JSON.stringify(token)});
      localStorage.setItem('ss-pair-token', ${JSON.stringify(token)});
      location.replace(${JSON.stringify(safeNext)});
    } catch (e) {
      document.body.innerText = 'Could not finish sign-in. Try again from /account.';
    }
  </script>
</body>`);
    } catch (err) {
        console.error('[oauth/apple] callback failed:', err.stack || err.message);
        sendError('Apple sign-in failed. Please try again.');
    }
});

// ── Devices (TV pairing — no auth required on register) ──────────────────

router.get('/receiver-config', (req, res) => {
    const overrideUrl = (process.env.RECEIVER_OVERRIDE_URL || '').trim();
    res.setHeader('Cache-Control', 'no-store');
    res.json({
        overrideUrl: overrideUrl.startsWith('https://starsol.app/') ? overrideUrl : null,
        forceUpdate: process.env.FORCE_APP_UPDATE === 'true',
        maintenanceMessage: (process.env.MAINTENANCE_MESSAGE || '').trim() || null,
        ts: Date.now(),
    });
});

// TV calls this on startup to get a pairing code (before user has account)
router.post('/devices/register', async (req, res) => {
    try {
        const { platform = 'google_tv', device_fingerprint, device_name, client, version } = req.body || {};
        const rawFingerprint = device_fingerprint || [
            req.ip,
            req.get('user-agent') || '',
            platform,
            client || '',
            version || '',
        ].join('|');
        if (!rawFingerprint.trim()) return res.status(400).json({ error: 'missing_fingerprint' });

        const fingerprint = crypto.createHash('sha256').update(rawFingerprint).digest('hex');
        const deviceName = device_name || client || platform.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());

        const { code, expiresAt } = await store.devices.register({ platform, fingerprint, deviceName });
        res.json({
            pairing_code: code,
            expires_at: expiresAt,
            code,
            expiresAt,
        });
    } catch (err) {
        console.error('/devices/register', err);
        res.status(500).json({ error: 'server_error' });
    }
});

// User enters code on web/phone to link TV to their account
router.post('/devices/pair', authMiddleware, async (req, res) => {
    try {
        const { pairing_code } = req.body;
        if (!pairing_code || pairing_code.length !== 6) {
            return res.status(400).json({ error: 'invalid_code' });
        }
        const device = await store.devices.pair(pairing_code.toUpperCase(), req.user.id);
        if (!device) return res.status(404).json({ error: 'code_not_found_or_expired' });
        res.json({ success: true, device_id: device.id });
    } catch (err) {
        console.error('/devices/pair', err);
        res.status(500).json({ error: 'server_error' });
    }
});

// TV polls this to know when it's been paired
router.get('/devices/pair/status', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'missing_code' });
    const device = await store.devices.findByPairingCode(code.toUpperCase());
    if (!device) {
        // Code was consumed — check if it's a device that got paired (pairing_code becomes NULL)
        return res.json({ paired: false });
    }
    const paired = !!device.user_id;
    if (paired) {
        // Issue a device-scoped token for the paired user
        const user = await store.users.findById(device.user_id);
        const token = issueToken(user);
        return res.json({ paired: true, token, user: safeUser(user) });
    }
    res.json({ paired: false });
});

router.get('/devices', authMiddleware, async (req, res) => {
    const devices = await store.devices.findByUserId(req.user.id);
    res.json({ devices });
});

router.delete('/devices/:id', authMiddleware, async (req, res) => {
    await store.devices.remove(parseInt(req.params.id), req.user.id);
    res.json({ success: true });
});

// ── Free window check (TV calls this to know if it needs to prompt signup) ─

router.post('/devices/check-access', async (req, res) => {
    const { device_fingerprint } = req.body;
    if (!device_fingerprint) return res.status(400).json({ error: 'missing_fingerprint' });

    const fp = crypto.createHash('sha256').update(device_fingerprint).digest('hex');
    const device = await store.devices.findByFingerprint(fp);
    if (!device) return res.json({ access: 'free', requires_signup: false });

    if (device.user_id) {
        const user = await store.users.findById(device.user_id);
        const sub = await store.subscriptions.findByUserId(device.user_id);
        return res.json({
            access: sub?.plan ?? user.plan ?? 'free',
            requires_signup: false,
            user_id: device.user_id,
        });
    }

    const ageMs = Date.now() - device.created_at;
    const requiresSignup = ageMs > FREE_WINDOW_MS;
    res.json({ access: 'free', requires_signup: requiresSignup, age_ms: ageMs });
});

// ── Content ───────────────────────────────────────────────────────────────

router.get('/content', async (req, res) => {
    const { type, tier, tag, limit = 20, offset = 0 } = req.query;
    const plan = await planFromOptionalAuth(req);
    const items = await store.content.list({
        type, tier, tag,
        limit: Math.min(parseInt(limit), 100),
        offset: parseInt(offset),
    });
    res.json({ content: items.filter(item => canAccessTier(plan, item.tier)) });
});

router.get('/content/:slug', async (req, res) => {
    const item = await store.content.findBySlug(req.params.slug);
    if (!item) return res.status(404).json({ error: 'not_found' });
    const plan = await planFromOptionalAuth(req);
    if (!canAccessTier(plan, item.tier)) {
        return res.status(403).json({ error: 'upgrade_required', required_plan: item.tier });
    }
    res.json({ content: item });
});

// ── Ambient images ────────────────────────────────────────────────────────

router.get('/ambient', async (req, res) => {
    // Optional auth — observer gets full library
    let tier = 'free';
    const auth = req.headers.authorization;
    if (auth) {
        try {
            const jwt = require('jsonwebtoken');
            const payload = jwt.verify(auth.replace('Bearer ', ''), process.env.JWT_SECRET);
            const user = await store.users.findById(payload.sub);
            tier = user?.plan ?? 'free';
        } catch {}
    }
    const images = await store.ambientImages.list({ tier, limit: 100 });
    res.json({ images });
});

// ── APOD (NASA Astronomy Picture of the Day) ──────────────────────────────

let apodCache = null;
let apodCachedAt = 0;
const APOD_TTL_MS = 23 * 60 * 60 * 1000; // 23 hours — refreshes daily

router.get('/apod', async (_req, res) => {
    try {
        const now = Date.now();
        if (apodCache && now - apodCachedAt < APOD_TTL_MS) {
            return res.json(apodCache);
        }
        const key = process.env.NASA_API_KEY || 'DEMO_KEY';
        const resp = await fetch(`https://api.nasa.gov/planetary/apod?api_key=${key}`);
        if (!resp.ok) throw new Error(`NASA API ${resp.status}`);
        const data = await resp.json();
        // Normalize to a consistent shape the TV receiver expects
        const payload = {
            title: data.title,
            date: data.date,
            explanation: data.explanation,
            url: data.hdurl || data.url,
            media_type: data.media_type,
            copyright: data.copyright ?? null,
            credit: data.copyright ? `Image Credit & Copyright: ${data.copyright}` : 'NASA / Public Domain',
        };
        apodCache = payload;
        apodCachedAt = now;
        res.json(payload);
    } catch (err) {
        console.error('/apod', err.message);
        // Return last cached value on failure rather than an error
        if (apodCache) return res.json(apodCache);
        res.status(503).json({ error: 'apod_unavailable' });
    }
});

// ── Sky events ────────────────────────────────────────────────────────────

router.get('/sky-events', async (req, res) => {
    const { hours = 168 } = req.query; // default 7 days ahead
    const events = await store.skyEvents.upcoming({ hoursAhead: parseInt(hours), limit: 50 });
    res.json({ events });
});

router.get('/observer/summary', authMiddleware, requirePlan('observer'), observer.observerSummary);
router.get('/observer/iss-passes', authMiddleware, requirePlan('observer'), observer.issPasses);

// ── Billing ───────────────────────────────────────────────────────────────

router.post('/billing/checkout', authMiddleware, async (req, res) => {
    try {
        const { plan, success_url, cancel_url } = req.body;
        const validPlans = ['explorer_monthly','explorer_annual','observer_monthly','observer_annual'];
        if (!validPlans.includes(plan)) return res.status(400).json({ error: 'invalid_plan' });
        const url = await billing.createCheckoutSession(req.user, plan, success_url, cancel_url);
        res.json({ url });
    } catch (err) {
        console.error('/billing/checkout', err);
        res.status(500).json({ error: 'server_error' });
    }
});

router.post('/billing/portal', authMiddleware, async (req, res) => {
    try {
        const url = await billing.createPortalSession(req.user, req.body.return_url);
        if (!url) return res.status(404).json({ error: 'no_subscription' });
        res.json({ url });
    } catch (err) {
        console.error('/billing/portal', err);
        res.status(500).json({ error: 'server_error' });
    }
});

// Raw body needed for Stripe webhook signature verification
router.post('/billing/webhook',
    express.raw({ type: 'application/json' }),
    async (req, res) => {
        try {
            await billing.handleWebhook(req.body, req.headers['stripe-signature']);
            res.json({ received: true });
        } catch (err) {
            console.error('/billing/webhook', err.message);
            res.status(400).json({ error: err.message });
        }
    }
);

// ── Watch history ─────────────────────────────────────────────────────────

router.get('/history', authMiddleware, async (req, res) => {
    const history = await store.watchHistory.get(req.user.id);
    res.json({ history });
});

router.post('/history', authMiddleware, async (req, res) => {
    const { content_id, watched_seconds = 0, completed = false } = req.body;
    if (!content_id) return res.status(400).json({ error: 'missing_content_id' });
    await store.watchHistory.upsert(req.user.id, content_id, watched_seconds, completed);
    res.json({ success: true });
});

// ── Contact / institutional inquiry ──────────────────────────────────────

router.post('/contact', async (req, res) => {
    const { name, email: from, organization, message } = req.body || {};
    if (!from || !message) return res.status(400).json({ error: 'missing_fields' });
    try {
        const safeName = escapeHtml(name || '—');
        const safeFrom = escapeHtml(from);
        const safeOrg = escapeHtml(organization || '—');
        const safeMessage = escapeHtml(message).replace(/\n/g, '<br>');
        await email.sendEmail({
            to: process.env.EMAIL_SUPPORT || 'starsol@salzventure.com',
            from: process.env.EMAIL_NOREPLY || 'starsol-noreply@salzventure.com',
            subject: sanitizeSubject(`StarSol institutional inquiry from ${name || from}`),
            html: `<p><strong>Name:</strong> ${safeName}</p><p><strong>Email:</strong> ${safeFrom}</p><p><strong>Organization:</strong> ${safeOrg}</p><p><strong>Message:</strong><br>${safeMessage}</p>`,
            campaign: 'contact_inquiry',
        });
        res.json({ ok: true });
    } catch (err) {
        console.error('/contact', err);
        res.status(500).json({ error: 'send_failed' });
    }
});

// ── Admin ─────────────────────────────────────────────────────────────────

router.use('/admin', admin);

// ── Helpers ───────────────────────────────────────────────────────────────

function safeUser(user) {
    const { password_hash, ...safe } = user;
    return safe;
}

async function planFromOptionalAuth(req) {
    const auth = req.headers.authorization || '';
    if (!auth.startsWith('Bearer ')) return 'free';
    try {
        const jwt = require('jsonwebtoken');
        const payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
        const user = await store.users.findById(payload.sub);
        return user?.plan || 'free';
    } catch {
        return 'free';
    }
}

function canAccessTier(plan, tier) {
    const planIdx = PLAN_ORDER.indexOf(plan || 'free');
    const tierIdx = PLAN_ORDER.indexOf(tier || 'free');
    return planIdx >= 0 && tierIdx >= 0 && planIdx >= tierIdx;
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    }[c]));
}

function sanitizeSubject(value) {
    return String(value ?? '').replace(/[\r\n]+/g, ' ').slice(0, 180);
}

// ── Google Play Billing ────────────────────────────────────────────────────
router.post("/play-billing/rtdn",   playBilling.handleRtdn);
router.post("/play-billing/verify", authMiddleware, playBilling.handleVerify);

module.exports = router;
