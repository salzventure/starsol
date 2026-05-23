'use strict';

const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('./auth');
const store = require('./store');

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
