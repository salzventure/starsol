'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
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
