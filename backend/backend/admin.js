'use strict';

const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware, verifyPassword, hashPassword } = require('./auth');
const store = require('./store');
const Stripe = require('stripe');
const crypto = require('crypto');
const emailTemplates = require('./email_templates');
const emailDesign = require('./email_design');
const { sendEmail } = require('./email');
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

const DAY_MS = 86_400_000;
const PRICES = Object.freeze({
    explorer: {
        month: Number(process.env.ADMIN_EXPLORER_MONTHLY_USD || 1.99),
        year: Number(process.env.ADMIN_EXPLORER_ANNUAL_USD || 9.99),
    },
});

function intervalForSubscription(row) {
    const priceId = String(row.stripe_price_id || '');
    const annualIds = [
        process.env.STRIPE_PRICE_EXPLORER_ANNUAL,
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
                SUM(plan='observer') legacy_observer_users, SUM(plan='institutional') institutional_users,
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
                byPlan: { free: Number(u.free_users || 0), member: Number(u.explorer_users || 0) + Number(u.legacy_observer_users || 0), institutional: Number(u.institutional_users || 0) } },
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
    const q = String(req.query.q || '').trim();
    const where = q ? 'WHERE email LIKE ? OR name LIKE ?' : '';
    const params = q ? [`%${q}%`, `%${q}%`] : [];
    const users = await store.query(`SELECT id,name,email,role,plan,email_verified,created_at,last_login_at,locked_until FROM users ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
    const { total } = await store.queryOne(`SELECT COUNT(*) as total FROM users ${where}`, params);
    res.json({ users, total, limit, offset });
});

router.get('/users/:id', async (req, res) => {
    const user = await store.users.findById(parseInt(req.params.id));
    if (!user) return res.status(404).json({ error: 'not_found' });
    const sub = await store.subscriptions.findByUserId(user.id);
    const devices = await store.devices.findByUserId(user.id);
    const { password_hash, ...safe } = user;
    safe.status = safe.locked_until && safe.locked_until > Date.now() ? 'suspended' : 'active';
    res.json({ user: safe, subscription: sub, paymentSources: sub ? [{...sub,source:'stripe'}] : [], devices });
});

router.get('/me', async (req, res) => {
    const user = await store.users.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'not_found' });
    res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role, plan: user.plan } });
});
router.post('/me/password', async (req, res) => {
    if (!req.body.currentPassword || !req.body.newPassword || req.body.newPassword.length < 8) return res.status(400).json({ error:'invalid_input' });
    const user = await store.users.findById(req.user.id);
    if (!user?.password_hash || !(await verifyPassword(req.body.currentPassword, user.password_hash))) return res.status(401).json({ error:'invalid_credentials' });
    await store.users.setPasswordHash(user.id, await hashPassword(req.body.newPassword));
    await store.users.incrementSessionVersion(user.id);
    res.json({ success:true, reloginRequired:true });
});

router.get('/users/:id/analytics', async (req, res) => {
    const id = parseInt(req.params.id);
    const [usage, events] = await Promise.all([
        store.queryOne('SELECT COUNT(*) sessionCount, COALESCE(SUM(watched_seconds),0) totalSeconds FROM watch_history WHERE user_id=?', [id]).catch(() => ({})),
        store.query('SELECT type event, COUNT(*) count FROM events WHERE user_id=? GROUP BY type ORDER BY count DESC LIMIT 20', [id]).catch(() => []),
    ]);
    res.json({ totalUsageMs: Number(usage?.totalSeconds || 0) * 1000, sessionCount: Number(usage?.sessionCount || 0), featureUsage: events });
});

router.get('/users/:id/credits', (_req, res) => res.json({ credits: [], availability: 'not_configured' }));
router.get('/users/:id/referrals', (_req, res) => res.json({ referees: [], availability: 'not_configured' }));
router.post('/users/:id/plan', async (req, res) => {
    const valid = ['free','explorer','observer','institutional'];
    if (!valid.includes(req.body.plan)) return res.status(400).json({ error: 'invalid_plan' });
    await store.users.updatePlan(parseInt(req.params.id), req.body.plan);
    res.json({ success: true });
});

router.post('/users/:id/role', async (req, res) => {
    if (req.user.role !== 'superadmin') return res.status(403).json({ error:'forbidden' });
    const role = req.body.role === 'user' ? 'free' : req.body.role;
    if (!['free','admin','superadmin'].includes(role)) return res.status(400).json({ error:'invalid_role' });
    await store.execute('UPDATE users SET role=? WHERE id=?', [role, parseInt(req.params.id)]);
    res.json({ success:true });
});
router.post('/users/:id/suspend', async (req, res) => {
    if (req.user.role !== 'superadmin') return res.status(403).json({ error:'forbidden' });
    await store.execute('UPDATE users SET locked_until=?,session_version=session_version+1 WHERE id=?', [Date.now()+100*365*86400000, parseInt(req.params.id)]);
    res.json({ success:true });
});
router.post('/users/:id/unsuspend', async (req, res) => {
    if (req.user.role !== 'superadmin') return res.status(403).json({ error:'forbidden' });
    await store.execute('UPDATE users SET locked_until=NULL,failed_login_attempts=0 WHERE id=?', [parseInt(req.params.id)]);
    res.json({ success:true });
});
router.post('/users/:id/password-reset', async (req, res) => {
    const user = await store.users.findById(parseInt(req.params.id));
    if (!user) return res.status(404).json({ error:'not_found' });
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresInMs = 3600000;
    await store.passwordResets.clearForUser(user.id);
    await store.passwordResets.create(user.id, tokenHash, Date.now()+expiresInMs);
    const resetUrl = `${process.env.PUBLIC_URL || 'https://starsol.app'}/reset-password?token=${token}`;
    if (req.body.delivery === 'email') await emailTemplates.sendPasswordReset(user, token);
    res.json({ success:true, resetUrl, sentTo:req.body.delivery === 'email' ? user.email : null, expiresInMs });
});

router.get('/subscriptions', async (req, res) => {
    const limit = Math.min(Math.max(parseInt(req.query.limit || '100'), 1), 500);
    const offset = Math.max(parseInt(req.query.offset || '0'), 0);
    const [stripeRows, playRows] = await Promise.all([
        store.query(`SELECT s.*,u.email,'stripe' source,s.current_period_end expires_at FROM subscriptions s JOIN users u ON u.id=s.user_id`).catch(() => []),
        store.query(`SELECT p.*,u.email,'play' source,p.expiry_ms expires_at FROM play_subscriptions p JOIN users u ON u.id=p.user_id`).catch(() => []),
    ]);
    let rows = [...stripeRows, ...playRows];
    if (req.query.source) rows = rows.filter(r => r.source === req.query.source);
    if (req.query.status) rows = rows.filter(r => r.status === req.query.status);
    if (req.query.plan) rows = rows.filter(r => r.plan === req.query.plan);
    rows.sort((a,b) => Number(b.updated_at || 0) - Number(a.updated_at || 0));
    const total = rows.length; rows = rows.slice(offset, offset + limit);
    res.json({ subscriptions: rows, subs: rows, total, limit, offset, providers:{stripe:{available:true},play:{available:true},apple:{available:false}} });
});

router.get('/errors', async (_req, res) => {
    const rows = await store.query(`SELECT COALESCE(event,type,'unknown') signature,MAX(ts) last_seen,COUNT(*) hits,COUNT(DISTINCT user_id) users
        FROM events WHERE type='error' OR event LIKE '%error%' GROUP BY COALESCE(event,type,'unknown') ORDER BY last_seen DESC LIMIT 100`).catch(() => []);
    res.json({ errors: rows.map(r => ({ signature:r.signature, message:r.signature, source:'event', lastSeen:r.last_seen, hits:Number(r.hits), users:Number(r.users), occurrences:[] })) });
});
router.get('/audit', (_req, res) => res.json({ entries: [], availability: 'not_configured' }));
router.get('/invites', (_req, res) => res.json({ invites: [], availability: 'not_configured' }));
router.get('/referrals', (_req, res) => res.json({ referrers: [], availability: 'not_configured' }));

router.get('/email/campaigns', async (_req, res) => {
    const definitions = [
        { id:'welcome', name:'Welcome', kind:'transactional' }, { id:'email_verify', name:'Verify email', kind:'transactional' },
        { id:'password_reset', name:'Password reset', kind:'transactional' }, { id:'D1_look_up', name:'Day 1 — Look up', kind:'marketing' },
        { id:'D7_convert', name:'Day 7 — Convert', kind:'marketing' }, { id:'admin_daily', name:'Admin daily', kind:'internal' },
    ];
    const counts = await store.query(`SELECT campaign,
        COUNT(*) sent, SUM(status='delivered') delivered, SUM(status='opened') opened,
        SUM(status='clicked') clicked, SUM(status='bounced') bounced
        FROM email_sends WHERE sent_at >= ? GROUP BY campaign`, [Date.now()-30*DAY_MS]).catch(() => []);
    const byCampaign = new Map(counts.map(r => [r.campaign, r]));
    res.json({ campaigns:definitions.map(c => { const n=byCampaign.get(c.id)||{}; return {...c,triggerDescription:c.name,cooldownDays:null,maxLifetime:null,hasOverride:false,sent:Number(n.sent||0),suppressed:0,delivered:Number(n.delivered||0),opened:Number(n.opened||0),clicked:Number(n.clicked||0),bounced:Number(n.bounced||0)}; }) });
});
router.get('/email/overrides', (_req, res) => res.json({ overrides: {}, availability: 'not_configured' }));
router.get('/email/lastrun', (_req, res) => res.json({ lastRun: null }));
router.get('/email/sends', async (req, res) => {
    const limit = Math.min(Math.max(parseInt(req.query.limit || '100'), 1), 500);
    const rows = await store.query('SELECT * FROM email_sends ORDER BY sent_at DESC LIMIT ?', [limit]).catch(() => []);
    res.json({ sends: rows });
});
router.get('/email/preview/:key', (req, res) => {
    const key = String(req.params.key || 'campaign');
    if (!emailTemplates.CAMPAIGNS[key]) return res.status(404).json({ error:'unknown_campaign' });
    const subject = `StarSol — ${key.replaceAll('_',' ')}`;
    const preheader = `Preview of the ${key.replaceAll('_',' ')} email.`;
    const html = emailDesign.wrap({ preheader, body:[emailDesign.h1(subject),emailDesign.p('This is the current StarSol campaign preview.'),emailDesign.ctaButton('Open StarSol', process.env.APP_URL || 'https://starsol.app')].join('') });
    if (req.query.json === '1') return res.json({ key, subject, preheader, html });
    res.type('html').send(html);
});
router.post('/email/test', async (req, res) => {
    const campaign = String(req.body.campaign || 'campaign');
    const html = emailDesign.wrap({ preheader:'StarSol test email', body:emailDesign.h1(`Test: ${campaign.replaceAll('_',' ')}`)+emailDesign.p('This is an admin-requested test email.') });
    await sendEmail({ to:req.user.email, subject:`StarSol test — ${campaign}`, html, userId:req.user.id, campaign:`admin_test_${campaign}` });
    res.json({ success:true, sentTo:req.user.email });
});
router.get('/waitlist/stats', (_req, res) => res.json({ total:0, availability:'not_configured' }));
router.get('/waitlist', (_req, res) => res.json({ entries:[], availability:'not_configured' }));

const notConfigured = (_req, res) => res.status(409).json({ error:'feature_not_configured_for_starsol' });
router.post('/invites', notConfigured); router.delete('/invites/:id', notConfigured);
router.patch('/users/:id/referral-limit', notConfigured);
router.post('/email/runnow', notConfigured); router.post('/email/overrides/:key', notConfigured); router.delete('/email/overrides/:key', notConfigured);
router.get('/email/campaigns/:key/timeseries', (_req,res)=>res.json({points:[]}));
router.post('/waitlist/notify', notConfigured); router.post('/trial/backfill', notConfigured);
router.post('/users/:id/trial/grant', notConfigured); router.post('/users/:id/trial/extend', notConfigured); router.post('/users/:id/trial/end', notConfigured);
router.post('/users/:id/credit', notConfigured); router.post('/users/:id/stripe-coupon', notConfigured); router.post('/users/:id/totp-reset', notConfigured);
router.post('/credits/:id/revoke', notConfigured);
router.patch('/feature-flags/:key', notConfigured); router.post('/promo-codes', notConfigured); router.patch('/promo-codes/:id/disable', notConfigured);
router.post('/announcements', notConfigured); router.patch('/announcements/:id', notConfigured); router.delete('/announcements/:id', notConfigured);

router.get('/revenue', async (_req, res) => {
    const metrics = await Promise.all([
        store.query(`SELECT plan,stripe_price_id,COUNT(*) n FROM subscriptions WHERE status='active' AND cancel_at_period_end=0 GROUP BY plan,stripe_price_id`).catch(() => []),
        store.query(`SELECT plan,subscription_id,COUNT(*) n FROM play_subscriptions WHERE status IN ('active','in_grace_period') AND auto_renewing=1 GROUP BY plan,subscription_id`).catch(() => []),
    ]);
    const r = calculateRevenue(metrics[0], metrics[1]);
    res.json({ mrr:r.mrrApprox, arr:r.arrApprox, breakdown:r.bySource, note:'Estimated gross recurring revenue; lifetime collections are shown separately.' });
});

let revenueCache = null;
router.get('/revenue/history', async (_req, res) => {
    if (revenueCache && Date.now() - revenueCache.at < 900000) return res.json(revenueCache.value);
    if (!stripe) return res.json({ lifetimeGrossRevenue:null, quarters:[], complete:false, providers:{stripe:{available:false,grossRevenue:null},play:{available:false,grossRevenue:null}}, note:'Stripe is not configured; Google Play does not expose lifetime transaction history to this backend.' });
    try {
        const totals = new Map(); let lifetime = 0; let invoices = 0;
        for await (const charge of stripe.charges.list({ limit:100 })) {
            if (!charge.paid || charge.status !== 'succeeded') continue;
            const cents = Math.max(0, Number(charge.amount || 0) - Number(charge.amount_refunded || 0));
            const date = new Date(Number(charge.created) * 1000); const key = `${date.getUTCFullYear()} Q${Math.floor(date.getUTCMonth()/3)+1}`;
            const row = totals.get(key) || { quarter:key, revenue:0, invoices:0, sort:Date.UTC(date.getUTCFullYear(),Math.floor(date.getUTCMonth()/3)*3) };
            row.revenue += cents / 100; row.invoices++; totals.set(key,row); lifetime += cents / 100; invoices++;
        }
        const quarters = [...totals.values()].sort((a,b)=>a.sort-b.sort).map(({sort,...r})=>({...r,revenue:Number(r.revenue.toFixed(2))}));
        const value = { lifetimeGrossRevenue:Number(lifetime.toFixed(2)), quarters, complete:false, providers:{stripe:{available:true,grossRevenue:Number(lifetime.toFixed(2)),invoiceCount:invoices},play:{available:false,grossRevenue:null}}, note:'Stripe collected charges net of refunds are included. Google Play lifetime transaction history is unavailable, so totals are partial.' };
        revenueCache = { at:Date.now(), value }; res.json(value);
    } catch (err) { console.error('/admin/revenue/history', err); res.status(502).json({ error:'revenue_provider_unavailable' }); }
});

router.get('/announcements', (_req, res) => res.json({ announcements:[], availability:'not_configured' }));
router.get('/feature-flags', (_req, res) => res.json({ flags:[], availability:'not_configured' }));
router.get('/promo-codes', (_req, res) => res.json({ codes:[], availability:'not_configured' }));
router.get('/flight-api/usage', async (_req, res) => {
    const [content, ambient] = await Promise.all([
        store.queryOne('SELECT COUNT(*) n FROM content WHERE is_published=1').catch(() => ({n:0})),
        store.queryOne('SELECT COUNT(*) n FROM ambient_images').catch(() => ({n:0})),
    ]);
    res.json({ today:Number(content?.n||0), thisMonth:Number(ambient?.n||0), stubMode:false, byEndpoint:[], availability:'available' });
});
router.get('/airports/popular', async (_req, res) => {
    const rows = await store.query('SELECT id,title,content_type,is_published FROM content ORDER BY updated_at DESC,created_at DESC LIMIT 25').catch(() => []);
    res.json({ airports:rows.map(r => ({ iata:String(r.id), city:r.title, count:r.is_published?'Yes':'No', type:r.content_type })), availability:'available' });
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
