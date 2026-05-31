'use strict';
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const store = require('./backend/store');
const routes = require('./backend/routes');

const PORT = parseInt(process.env.PORT || '3402', 10);

const app = express();

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", 'https://accounts.google.com', 'https://js.stripe.com', 'https://fonts.googleapis.com'],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com'],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'", 'https://api.stripe.com'],
            frameSrc: ["'self'", 'https://js.stripe.com'],
        },
    },
}));
const corsOriginsEnv = process.env.CORS_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean) ?? [];
const allowedOrigins = corsOriginsEnv.length > 0 ? corsOriginsEnv : ['https://starsol.app'];
app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
}));
const jsonParser = express.json({ limit: '1mb' });
app.use((req, res, next) => {
    if (req.originalUrl === '/api/billing/webhook') return next();
    return jsonParser(req, res, next);
});

// Rate limiters
const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
});
const pairLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
});
const contactLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
});
const checkoutLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
});

app.use('/api/auth/login', strictLimiter);
app.use('/api/auth/register', strictLimiter);
app.use('/api/auth/forgot', strictLimiter);
app.use('/api/auth/reset', strictLimiter);
app.use('/api/auth/google', strictLimiter);
app.use('/api/auth/siwa', strictLimiter);
app.use('/api/devices/register', pairLimiter);
app.use('/api/devices/pair/status', pairLimiter);
app.use('/api/contact', contactLimiter);
app.use('/api/billing/checkout', checkoutLimiter);

// Health check (unauthenticated, used by deploy scripts)
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', app: 'starsol-api', ts: Date.now() });
});

app.use('/api', routes);

// Companion web pages — served by the Node process, proxied via Apache
app.get('/pair', (_req, res) => res.sendFile(path.join(__dirname, 'web/pair.html')));
app.get('/pricing', (_req, res) => res.sendFile(path.join(__dirname, 'web/pricing.html')));
app.get('/account', (_req, res) => res.sendFile(path.join(__dirname, 'web/account.html')));
app.get('/terms', (_req, res) => res.sendFile(path.join(__dirname, 'web/terms.html')));
app.get('/privacy', (_req, res) => res.sendFile(path.join(__dirname, 'web/privacy.html')));
app.get('/reset-password', (_req, res) => res.sendFile(path.join(__dirname, 'web/reset-password.html')));
app.get('/tv', (_req, res) => res.sendFile(path.join(__dirname, 'web/tv.html')));

// Global error handler
app.use((err, req, res, next) => {
    console.error('[unhandled]', err);
    if (res.headersSent) return next(err);
    res.status(500).json({ error: 'server_error' });
});
process.on('unhandledRejection', (reason) => console.error('[unhandledRejection]', reason));
process.on('uncaughtException', (err) => { console.error('[uncaughtException]', err); process.exit(1); });

async function main() {
    await store.runMigrations();
    app.listen(PORT, () => {
        console.log(`[StarSol] Server running on port ${PORT}`);
    });
    // Daily sweep: demote canceled subscriptions whose paid period has lapsed.
    // Runs once at startup (catches any missed while server was down) then every 24h.
    async function sweepLapsedSubs() {
        try {
            const n = await store.subscriptions.expireLapsed();
            if (n > 0) console.log(`[billing] expireLapsed: demoted ${n} subscription(s)`);
        } catch (e) {
            console.error('[billing] expireLapsed sweep failed:', e);
        }
    }
    sweepLapsedSubs();
    setInterval(sweepLapsedSubs, 24 * 60 * 60 * 1000);
}

main().catch(err => {
    console.error('[StarSol] Startup error:', err);
    process.exit(1);
});
