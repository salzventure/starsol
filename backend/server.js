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
app.use(cors({ origin: process.env.CORS_ORIGINS?.split(',') ?? '*', credentials: true }));
app.use(express.json({ limit: '1mb' }));

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
