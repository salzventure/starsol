'use strict';

const express = require('express');
const router = express.Router();
const crypto = require('crypto');

const store = require('./store');
const { issueToken, hashPassword, verifyPassword, authMiddleware, requirePlan } = require('./auth');
const billing = require('./billing');
const admin = require('./admin');

const FREE_WINDOW_MS = 2 * 24 * 60 * 60 * 1000; // 2 days before requiring account

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
    res.json({ user: safeUser(req.user), subscription: sub });
});

// ── Devices (TV pairing — no auth required on register) ──────────────────

// TV calls this on startup to get a pairing code (before user has account)
router.post('/devices/register', async (req, res) => {
    try {
        const { platform = 'google_tv', device_fingerprint, device_name } = req.body;
        if (!device_fingerprint) return res.status(400).json({ error: 'missing_fingerprint' });

        const fingerprint = crypto.createHash('sha256').update(device_fingerprint).digest('hex');
        const deviceName = device_name || platform.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());

        const { code, expiresAt } = await store.devices.register({ platform, fingerprint, deviceName });
        res.json({ pairing_code: code, expires_at: expiresAt });
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
        return res.json({ paired: true, token });
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
    const items = await store.content.list({
        type, tier, tag,
        limit: Math.min(parseInt(limit), 100),
        offset: parseInt(offset),
    });
    // Filter by user's plan if auth header present (optional auth)
    res.json({ content: items });
});

router.get('/content/:slug', async (req, res) => {
    const item = await store.content.findBySlug(req.params.slug);
    if (!item) return res.status(404).json({ error: 'not_found' });
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

// ── Sky events ────────────────────────────────────────────────────────────

router.get('/sky-events', async (req, res) => {
    const { hours = 168 } = req.query; // default 7 days ahead
    const events = await store.skyEvents.upcoming({ hoursAhead: parseInt(hours), limit: 50 });
    res.json({ events });
});

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

// ── Admin ─────────────────────────────────────────────────────────────────

router.use('/admin', admin);

// ── Helpers ───────────────────────────────────────────────────────────────

function safeUser(user) {
    const { password_hash, ...safe } = user;
    return safe;
}

module.exports = router;
