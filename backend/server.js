'use strict';
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const store = require('./backend/store');
const routes = require('./backend/routes');

const PORT = parseInt(process.env.PORT || '3402', 10);

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
const allowedOrigins = process.env.CORS_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean) ?? [];
app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
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

async function main() {
    await store.runMigrations();
    app.listen(PORT, () => {
        console.log(`[StarSol] Server running on port ${PORT}`);
    });
}

main().catch(err => {
    console.error('[StarSol] Startup error:', err);
    process.exit(1);
});
