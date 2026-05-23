'use strict';
// JWT (30d) + bcrypt (12 rounds). Same pattern as FlightPort.

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const store = require('./store');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET env var is required');

const JWT_EXPIRES = '30d';
const BCRYPT_ROUNDS = 12;
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

function issueToken(user) {
    return jwt.sign(
        { sub: user.id, email: user.email, plan: user.plan, sv: user.session_version },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES },
    );
}

async function hashPassword(password) {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
}

// Express middleware — attaches req.user or returns 401
async function authMiddleware(req, res, next) {
    res.set('Cache-Control', 'no-store, private');
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'missing_token' });

    let payload;
    try {
        payload = jwt.verify(token, JWT_SECRET);
    } catch {
        return res.status(401).json({ error: 'invalid_token' });
    }

    const user = await store.users.findById(payload.sub);
    if (!user) return res.status(401).json({ error: 'user_not_found' });
    if (payload.sv != null && payload.sv !== user.session_version) {
        return res.status(401).json({ error: 'session_invalidated' });
    }

    req.user = user;
    next();
}

// Middleware that requires a specific plan tier or above
const PLAN_ORDER = ['free', 'explorer', 'observer', 'institutional'];
function requirePlan(minPlan) {
    return (req, res, next) => {
        const userIdx = PLAN_ORDER.indexOf(req.user?.plan ?? 'free');
        const minIdx = PLAN_ORDER.indexOf(minPlan);
        if (userIdx < minIdx) {
            return res.status(403).json({ error: 'upgrade_required', required_plan: minPlan });
        }
        next();
    };
}

// Admin middleware — checks admin role
function adminMiddleware(req, res, next) {
    if (!req.user || !['admin', 'superadmin'].includes(req.user.role)) {
        return res.status(403).json({ error: 'forbidden' });
    }
    next();
}

// Simple API key check for internal/admin routes called without user context
function adminKeyMiddleware(req, res, next) {
    const key = req.headers['x-admin-key'] || req.query.admin_key;
    if (!key || key !== process.env.ADMIN_SECRET) {
        return res.status(403).json({ error: 'forbidden' });
    }
    next();
}

module.exports = {
    issueToken, hashPassword, verifyPassword,
    authMiddleware, requirePlan, adminMiddleware, adminKeyMiddleware,
    PLAN_ORDER,
};
