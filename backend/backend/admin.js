'use strict';

const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('./auth');
const store = require('./store');

const DAY_MS = 86_400_000;
const PRICES = Object.freeze({
    explorer: {
        month: Number(process.env.ADMIN_EXPLORER_MONTHLY_USD || 4.99),
        year: Number(process.env.ADMIN_EXPLORER_ANNUAL_USD || 39.99),
    },
    observer: {
        month: Number(process.env.ADMIN_OBSERVER_MONTHLY_USD || 7.99),
        year: Number(process.env.ADMIN_OBSERVER_ANNUAL_USD || 64.99),
    },
});

function intervalForSubscription(row) {
    const priceId = String(row.stripe_price_id || '');
    const annualIds = [
        process.env.STRIPE_PRICE_EXPLORER_ANNUAL,
        process.env.STRIPE_PRICE_OBSERVER_ANNUAL,
    ].filter(Boolean);
    if (annualIds.includes(priceId) || /annual|year/i.test(priceId)) return 'year';
    return 'month';
}

function monthlyValue(plan, interval) {
    const price = PRICES[plan];
    if (!price) return 0;
    return interval === 'year' ? price.year / 12 : price.month;
}

function calculateRevenue(stripeRows = [], playRows = []) {
    const bySource = { stripe: 0, play: 0 };
    for (const row of stripeRows) {
        bySource.stripe += monthlyValue(row.plan, intervalForSubscription(row)) * Number(row.n || 0);
    }
    for (const row of playRows) {
        const interval = /annual|year/i.test(String(row.subscription_id || '')) ? 'year' : 'month';
        bySource.play += monthlyValue(row.plan, interval) * Number(row.n || 0);
    }
    bySource.stripe = Number(bySource.stripe.toFixed(2));
    bySource.play = Number(bySource.play.toFixed(2));
    const mrrApprox = Number((bySource.stripe + bySource.play).toFixed(2));
    return { mrrApprox, arrApprox: Number((mrrApprox * 12).toFixed(2)), bySource };
}

// All admin routes require auth + admin role
router.use(authMiddleware, adminMiddleware);

// ── Dashboard stats ───────────────────────────────────────────────────────

router.get('/stats', async (_req, res) => {
    try {
        const [userCount, planCounts, recentUsers, contentCount] = await Promise.all([
            store.queryOne('SELECT COUNT(*) as total FROM users'),
            store.query('SELECT plan, COUNT(*) as count FROM users GROUP BY plan'),
            store.query('SELECT id, name, email, plan, created_at FROM users ORDER BY created_at DESC LIMIT 10'),
            store.queryOne('SELECT COUNT(*) as total FROM content WHERE is_published = 1'),
        ]);
        res.json({
            users: { total: userCount.total, by_plan: planCounts },
            recent_users: recentUsers,
            content: { published: contentCount.total },
        });
    } catch (err) {
        console.error('/admin/stats', err);
        res.status(500).json({ error: 'server_error' });
    }
});

// ── Business overview (shared admin-dashboard contract) ─────────────────

router.get('/metrics', async (_req, res) => {
    try {
        const now = Date.now();
        const ago = days => now - days * DAY_MS;
        const safe = (promise, fallback) => promise.catch(() => fallback);
        const [users, signups, activity, usage, errors, churn, trials, stripeSubs, playSubs, devices] = await Promise.all([
            safe(store.query(`SELECT COUNT(*) total,
                SUM(plan='free') free_users, SUM(plan='explorer') explorer_users,
                SUM(plan='observer') observer_users, SUM(plan='institutional') institutional_users,
                SUM(role IN ('admin','superadmin')) admin_users,
                SUM(failed_login_attempts >= 5 AND locked_until > ?) suspended
                FROM users`, [now]), [{ total: 0 }]),
            safe(store.query(`SELECT FLOOR((created_at - ?) / ?) day, COUNT(*) n FROM users
                WHERE created_at >= ? GROUP BY day ORDER BY day`, [ago(30), DAY_MS, ago(30)]), []),
            safe(store.query(`SELECT
                SUM(last_login_at >= ?) dau, SUM(last_login_at >= ?) wau, SUM(last_login_at >= ?) mau
                FROM users`, [ago(1), ago(7), ago(30)]), [{ dau: 0, wau: 0, mau: 0 }]),
            safe(store.query(`SELECT COUNT(*) total_sessions,
                COALESCE(SUM(watched_seconds),0) total_seconds FROM watch_history`), [{ total_sessions: 0, total_seconds: 0 }]),
            safe(store.query(`SELECT FLOOR((ts - ?) / ?) day, COUNT(*) n FROM events
                WHERE ts >= ? AND (type='error' OR event LIKE '%error%') GROUP BY day ORDER BY day`,
                [ago(14), DAY_MS, ago(14)]), []),
            safe(store.query(`SELECT COUNT(*) n FROM subscriptions
                WHERE status='canceled' AND updated_at >= ?`, [ago(30)]), [{ n: 0 }]),
            safe(store.query(`SELECT
                COUNT(*) started,
                SUM(s.status='trialing') active,
                SUM(s.status='active') converted,
                SUM(s.id IS NULL OR s.status IN ('canceled','past_due','incomplete')) expired
                FROM users u LEFT JOIN subscriptions s ON s.user_id=u.id
                WHERE u.trial_used_at IS NOT NULL`), [{ started: 0, active: 0, converted: 0, expired: 0 }]),
            safe(store.query(`SELECT plan, stripe_price_id, COUNT(*) n FROM subscriptions
                WHERE status='active' AND cancel_at_period_end=0 GROUP BY plan, stripe_price_id`), []),
            safe(store.query(`SELECT plan, subscription_id, COUNT(*) n FROM play_subscriptions
                WHERE status IN ('active','in_grace_period') AND auto_renewing=1
                AND (expiry_ms IS NULL OR expiry_ms > ?) GROUP BY plan, subscription_id`, [now]), []),
            safe(store.query(`SELECT platform, COUNT(DISTINCT user_id) n FROM devices
                WHERE user_id IS NOT NULL AND last_seen_at >= ? GROUP BY platform`, [ago(30)]), []),
        ]);

        const u = users[0] || {};
        const a = activity[0] || {};
        const w = usage[0] || {};
        const t = trials[0] || {};
        const settled = Number(t.started || 0) - Number(t.active || 0);
        const revenue = calculateRevenue(stripeSubs, playSubs);
        const activeBySource = [
            ...stripeSubs.map(row => ({ source: 'stripe', plan: row.plan, interval: intervalForSubscription(row), n: Number(row.n) })),
            ...playSubs.map(row => ({ source: 'play', plan: row.plan, interval: /annual|year/i.test(row.subscription_id || '') ? 'year' : 'month', n: Number(row.n) })),
        ];
        res.json({
            users: { total: Number(u.total || 0), active: Number(u.total || 0) - Number(u.suspended || 0), suspended: Number(u.suspended || 0),
                byPlan: { free: Number(u.free_users || 0), explorer: Number(u.explorer_users || 0), observer: Number(u.observer_users || 0), institutional: Number(u.institutional_users || 0) } },
            signupsByDay: signups.map(r => ({ day: ago(30) + Number(r.day) * DAY_MS, n: Number(r.n) })),
            activeBySource,
            engagement: { dau: Number(a.dau || 0), wau: Number(a.wau || 0), mau: Number(a.mau || 0), totalMs: Number(w.total_seconds || 0) * 1000, totalSessions: Number(w.total_sessions || 0) },
            revenue: { ...revenue, note: 'Estimated gross MRR from active auto-renewing Stripe and Google Play subscriptions. Institutional contracts are excluded.' },
            errorsByDay: errors.map(r => ({ day: ago(14) + Number(r.day) * DAY_MS, n: Number(r.n) })),
            churn30d: Number(churn[0]?.n || 0),
            trial: { started: Number(t.started || 0), active: Number(t.active || 0), converted: Number(t.converted || 0), expired: Number(t.expired || 0), conversionPct: settled > 0 ? Number((Number(t.converted || 0) / settled * 100).toFixed(1)) : null },
            tvByPlatform: Object.fromEntries(devices.map(r => [r.platform, Number(r.n)])),
            methodology: { activity: 'User last-login timestamps', usage: 'Watch-history rows and watched seconds', errors: 'Events marked as errors' },
        });
    } catch (err) {
        console.error('/admin/metrics', err);
        res.status(500).json({ error: 'server_error' });
    }
});

// ── Users ─────────────────────────────────────────────────────────────────

router.get('/users', async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit ?? 100), 500);
    const offset = parseInt(req.query.offset ?? 0);
    const users = await store.users.all(limit, offset);
    const { total } = await store.queryOne('SELECT COUNT(*) as total FROM users');
    res.json({ users, total, limit, offset });
});

router.get('/users/:id', async (req, res) => {
    const user = await store.users.findById(parseInt(req.params.id));
    if (!user) return res.status(404).json({ error: 'not_found' });
    const sub = await store.subscriptions.findByUserId(user.id);
    const devices = await store.devices.findByUserId(user.id);
    const { password_hash, ...safe } = user;
    res.json({ user: safe, subscription: sub, devices });
});

router.patch('/users/:id/plan', async (req, res) => {
    const { plan } = req.body;
    const valid = ['free','explorer','observer','institutional'];
    if (!valid.includes(plan)) return res.status(400).json({ error: 'invalid_plan' });
    await store.users.updatePlan(parseInt(req.params.id), plan);
    res.json({ success: true });
});

// ── Content ───────────────────────────────────────────────────────────────

router.get('/content', async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit ?? 100), 500);
    const offset = parseInt(req.query.offset ?? 0);
    const items = await store.content.adminList(limit, offset);
    res.json({ content: items, limit, offset });
});

router.post('/content', async (req, res) => {
    try {
        const id = await store.content.upsert(req.body);
        res.json({ success: true, id });
    } catch (err) {
        console.error('/admin/content POST', err);
        res.status(500).json({ error: 'server_error' });
    }
});

router.put('/content/:id', async (req, res) => {
    try {
        await store.content.upsert({ ...req.body, id: parseInt(req.params.id) });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'server_error' });
    }
});

router.delete('/content/:id', async (req, res) => {
    await store.content.delete(parseInt(req.params.id));
    res.json({ success: true });
});

// ── Ambient images ────────────────────────────────────────────────────────

router.get('/ambient', async (_req, res) => {
    const images = await store.ambientImages.list({ tier: 'observer', limit: 500 });
    res.json({ images });
});

router.post('/ambient', async (req, res) => {
    try {
        await store.ambientImages.upsert(req.body);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'server_error' });
    }
});

router.put('/ambient/:id', async (req, res) => {
    await store.ambientImages.upsert({ ...req.body, id: parseInt(req.params.id) });
    res.json({ success: true });
});

router.delete('/ambient/:id', async (req, res) => {
    await store.ambientImages.delete(parseInt(req.params.id));
    res.json({ success: true });
});

// ── Sky events ────────────────────────────────────────────────────────────

router.get('/sky-events', async (_req, res) => {
    const events = await store.skyEvents.upcoming({ hoursAhead: 8760, limit: 200 });
    res.json({ events });
});

router.post('/sky-events', async (req, res) => {
    try {
        const id = await store.skyEvents.upsert(req.body);
        res.json({ success: true, id });
    } catch (err) {
        res.status(500).json({ error: 'server_error' });
    }
});

router.put('/sky-events/:id', async (req, res) => {
    await store.skyEvents.upsert({ ...req.body, id: parseInt(req.params.id) });
    res.json({ success: true });
});

router.delete('/sky-events/:id', async (req, res) => {
    await store.skyEvents.delete(parseInt(req.params.id));
    res.json({ success: true });
});

module.exports = router;
module.exports._metrics = { intervalForSubscription, monthlyValue, calculateRevenue };
