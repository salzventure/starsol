'use strict';
// MySQL-backed store. All timestamps: BIGINT milliseconds (Date.now()). Never seconds.

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const sslCaPath = process.env.DB_SSL_CA;
const pool = mysql.createPool({
    host:               process.env.DB_HOST,
    port:               parseInt(process.env.DB_PORT || '3306', 10),
    user:               process.env.DB_USER,
    password:           process.env.DB_PASSWORD,
    database:           process.env.DB_NAME,
    ssl:                sslCaPath ? { ca: fs.readFileSync(sslCaPath) } : undefined,
    charset:            'utf8mb4_0900_ai_ci',
    waitForConnections: true,
    connectionLimit:    10,
    maxIdle:            10,
    idleTimeout:        60_000,
    enableKeepAlive:    true,
    keepAliveInitialDelay: 10_000,
});

// ── Migration runner ────────────────────────────────────────────────────
async function runMigrations() {
    console.log('[StarSol] Running migrations...');
    await pool.query(`
        CREATE TABLE IF NOT EXISTS _migrations (
            name VARCHAR(255) PRIMARY KEY,
            applied_at BIGINT NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

    for (const file of files) {
        const [rows] = await pool.query('SELECT name FROM _migrations WHERE name = ?', [file]);
        if (rows.length > 0) continue;

        const raw = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        const sql = raw.split('\n').filter(l => !l.trimStart().startsWith('--')).join('\n');
        const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);

        for (const stmt of statements) {
            try {
                await pool.query(stmt);
            } catch (err) {
                if (['ER_DUP_FIELDNAME','ER_CANT_DROP_FIELD_OR_KEY','ER_DUP_KEYNAME',
                     'ER_TABLE_EXISTS_ERROR','ER_DUP_ENTRY'].includes(err.code)) {
                    // idempotent — skip
                } else {
                    throw err;
                }
            }
        }

        await pool.query('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)', [file, Date.now()]);
        console.log(`[StarSol] Applied migration: ${file}`);
    }
    console.log('[StarSol] All migrations up to date.');
}

// ── Helpers ─────────────────────────────────────────────────────────────
async function query(sql, params) {
    const [rows] = await pool.query(sql, params);
    return rows;
}
async function queryOne(sql, params) {
    const rows = await query(sql, params);
    return rows[0] ?? null;
}
async function execute(sql, params) {
    const [result] = await pool.execute(sql, params);
    return result;
}

// ── Users ────────────────────────────────────────────────────────────────
const users = {
    findById: id => queryOne('SELECT * FROM users WHERE id = ?', [id]),
    findByEmail: email => queryOne('SELECT * FROM users WHERE email = ?', [email]),
    create: async ({ name, email, passwordHash }) => {
        const now = Date.now();
        const res = await execute(
            'INSERT INTO users (name, email, password_hash, plan, created_at) VALUES (?, ?, ?, "free", ?)',
            [name, email, passwordHash, now],
        );
        return { id: res.insertId, name, email, plan: 'free', created_at: now };
    },
    updatePlan: (id, plan) => execute('UPDATE users SET plan = ? WHERE id = ?', [plan, id]),
    updateStripeCustomerId: (id, customerId) =>
        execute('UPDATE users SET stripe_customer_id = ? WHERE id = ?', [customerId, id]),
    setPasswordHash: (id, hash) => execute('UPDATE users SET password_hash = ? WHERE id = ?', [hash, id]),
    incrementSessionVersion: id =>
        execute('UPDATE users SET session_version = session_version + 1 WHERE id = ?', [id]),
    recordLogin: (id) => execute('UPDATE users SET last_login_at = ? WHERE id = ?', [Date.now(), id]),
    resetLoginAttempts: id =>
        execute('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?', [id]),
    incrementLoginAttempts: async (id) => {
        await execute('UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE id = ?', [id]);
        const user = await users.findById(id);
        if (user.failed_login_attempts >= 5) {
            await execute('UPDATE users SET locked_until = ? WHERE id = ?', [Date.now() + 15*60*1000, id]);
        }
    },
    setEmailVerified: id => execute('UPDATE users SET email_verified = 1 WHERE id = ?', [id]),
    all: (limit = 500, offset = 0) =>
        query('SELECT id, name, email, plan, created_at, last_login_at, email_verified FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?', [limit, offset]),
    count: () => queryOne('SELECT COUNT(*) as total FROM users'),
};

// ── Subscriptions ────────────────────────────────────────────────────────
const subscriptions = {
    findByUserId: id => queryOne('SELECT * FROM subscriptions WHERE user_id = ?', [id]),
    findByStripeSubId: subId => queryOne('SELECT * FROM subscriptions WHERE stripe_subscription_id = ?', [subId]),
    findByStripeCustomerId: cid => queryOne('SELECT * FROM subscriptions WHERE stripe_customer_id = ?', [cid]),
    upsert: async (data) => {
        const { userId, stripeCustomerId, stripeSubscriptionId, stripePriceId, plan, status,
                periodStart, periodEnd, cancelAtPeriodEnd } = data;
        await execute(`
            INSERT INTO subscriptions
                (user_id, stripe_customer_id, stripe_subscription_id, stripe_price_id, plan, status,
                 current_period_start, current_period_end, cancel_at_period_end, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                stripe_subscription_id = VALUES(stripe_subscription_id),
                stripe_price_id        = VALUES(stripe_price_id),
                plan                   = VALUES(plan),
                status                 = VALUES(status),
                current_period_start   = VALUES(current_period_start),
                current_period_end     = VALUES(current_period_end),
                cancel_at_period_end   = VALUES(cancel_at_period_end),
                updated_at             = VALUES(updated_at)
        `, [userId, stripeCustomerId, stripeSubscriptionId, stripePriceId, plan, status,
            periodStart, periodEnd, cancelAtPeriodEnd ? 1 : 0, Date.now()]);
        await users.updatePlan(userId, plan);
    },
    cancel: async (stripeSubId) => {
        const sub = await subscriptions.findByStripeSubId(stripeSubId);
        if (!sub) return;
        await execute('UPDATE subscriptions SET plan = "free", status = "canceled", updated_at = ? WHERE stripe_subscription_id = ?',
            [Date.now(), stripeSubId]);
        await users.updatePlan(sub.user_id, 'free');
    },
    setPastDue: stripeSubId =>
        execute('UPDATE subscriptions SET status = "past_due", updated_at = ? WHERE stripe_subscription_id = ?',
            [Date.now(), stripeSubId]),
};

// ── Devices (TV pairing) ─────────────────────────────────────────────────
const devices = {
    findByFingerprint: fp => queryOne('SELECT * FROM devices WHERE device_fingerprint = ?', [fp]),
    findByPairingCode: code => queryOne('SELECT * FROM devices WHERE pairing_code = ? AND pairing_expires_at > ?', [code, Date.now()]),
    findByUserId: userId => query('SELECT * FROM devices WHERE user_id = ? ORDER BY last_seen_at DESC', [userId]),
    register: async ({ platform, fingerprint, deviceName }) => {
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        const expiresAt = Date.now() + 10 * 60 * 1000;
        await execute(`
            INSERT INTO devices (platform, device_fingerprint, device_name, pairing_code, pairing_expires_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                pairing_code = VALUES(pairing_code),
                pairing_expires_at = VALUES(pairing_expires_at),
                device_name = VALUES(device_name)
        `, [platform, fingerprint, deviceName, code, expiresAt, Date.now()]);
        return { code, expiresAt };
    },
    pair: async (code, userId) => {
        const device = await devices.findByPairingCode(code);
        if (!device) return null;
        if (device.user_id && device.user_id !== userId) return null;
        await execute(`UPDATE devices SET user_id = ?, pairing_code = NULL, pairing_expires_at = NULL,
            paired_at = ?, last_seen_at = ? WHERE id = ?`,
            [userId, Date.now(), Date.now(), device.id]);
        return device;
    },
    touch: id => execute('UPDATE devices SET last_seen_at = ? WHERE id = ?', [Date.now(), id]),
    remove: (id, userId) => execute('DELETE FROM devices WHERE id = ? AND user_id = ?', [id, userId]),
};

// ── Content ───────────────────────────────────────────────────────────────
const content = {
    findById: id => queryOne('SELECT * FROM content WHERE id = ? AND is_published = 1', [id]),
    findBySlug: slug => queryOne('SELECT * FROM content WHERE slug = ? AND is_published = 1', [slug]),
    list: ({ type, tier, tag, limit = 20, offset = 0 } = {}) => {
        const where = ['is_published = 1'];
        const params = [];
        if (type) { where.push('content_type = ?'); params.push(type); }
        if (tier) { where.push('tier = ?'); params.push(tier); }
        if (tag)  { where.push('JSON_CONTAINS(tags, JSON_QUOTE(?))'); params.push(tag); }
        params.push(limit, offset);
        return query(`SELECT * FROM content WHERE ${where.join(' AND ')} ORDER BY published_at DESC LIMIT ? OFFSET ?`, params);
    },
    adminList: (limit = 200, offset = 0) =>
        query('SELECT * FROM content ORDER BY created_at DESC LIMIT ? OFFSET ?', [limit, offset]),
    upsert: async (data) => {
        const now = Date.now();
        if (data.id) {
            await execute(`UPDATE content SET slug=?, title=?, description=?, short_description=?,
                thumbnail_url=?, backdrop_url=?, content_type=?, tier=?, duration_seconds=?,
                mux_asset_id=?, mux_playback_id=?, series_id=?, episode_number=?, tags=?,
                credit_line=?, is_published=?, updated_at=? WHERE id=?`,
                [data.slug, data.title, data.description, data.shortDescription,
                 data.thumbnailUrl, data.backdropUrl, data.type, data.tier, data.duration,
                 data.muxAssetId, data.muxPlaybackId, data.seriesId, data.episodeNumber,
                 JSON.stringify(data.tags ?? []), data.creditLine, data.isPublished ? 1 : 0, now, data.id]);
            return data.id;
        }
        const res = await execute(`INSERT INTO content
            (slug, title, description, short_description, thumbnail_url, backdrop_url,
             content_type, tier, duration_seconds, mux_asset_id, mux_playback_id, series_id,
             episode_number, tags, credit_line, is_published, published_at, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [data.slug, data.title, data.description, data.shortDescription,
             data.thumbnailUrl, data.backdropUrl, data.type, data.tier, data.duration,
             data.muxAssetId, data.muxPlaybackId, data.seriesId, data.episodeNumber,
             JSON.stringify(data.tags ?? []), data.creditLine, data.isPublished ? 1 : 0,
             data.isPublished ? now : null, now, now]);
        return res.insertId;
    },
    delete: id => execute('DELETE FROM content WHERE id = ?', [id]),
};

// ── Sky Events ────────────────────────────────────────────────────────────
const skyEvents = {
    upcoming: ({ limit = 20, hoursAhead = 168 } = {}) => {
        const until = Date.now() + hoursAhead * 60 * 60 * 1000;
        return query('SELECT * FROM sky_events WHERE starts_at > ? AND starts_at < ? ORDER BY starts_at ASC LIMIT ?',
            [Date.now(), until, limit]);
    },
    findById: id => queryOne('SELECT * FROM sky_events WHERE id = ?', [id]),
    upsert: async (data) => {
        if (data.id) {
            await execute(`UPDATE sky_events SET event_type=?, title=?, description=?, starts_at=?,
                ends_at=?, peak_at=?, is_geolocated=?, visibility_notes=?, tier=?, updated_at=? WHERE id=?`,
                [data.type, data.title, data.description, data.startsAt, data.endsAt, data.peakAt,
                 data.isGeolocated ? 1 : 0, data.visibilityNotes, data.tier, Date.now(), data.id]);
        } else {
            const res = await execute(`INSERT INTO sky_events
                (event_type, title, description, starts_at, ends_at, peak_at, is_geolocated,
                 visibility_notes, tier, source, created_at, updated_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
                [data.type, data.title, data.description, data.startsAt, data.endsAt, data.peakAt,
                 data.isGeolocated ? 1 : 0, data.visibilityNotes, data.tier ?? 'free',
                 data.source ?? 'manual', Date.now(), Date.now()]);
            return res.insertId;
        }
    },
    delete: id => execute('DELETE FROM sky_events WHERE id = ?', [id]),
};

// ── Watch History ─────────────────────────────────────────────────────────
const watchHistory = {
    get: userId => query('SELECT wh.*, c.title, c.slug, c.thumbnail_url FROM watch_history wh JOIN content c ON c.id = wh.content_id WHERE wh.user_id = ? ORDER BY wh.last_watched_at DESC LIMIT 50', [userId]),
    upsert: async (userId, contentId, watchedSeconds, completed) => {
        await execute(`INSERT INTO watch_history (user_id, content_id, watched_seconds, completed, last_watched_at)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE watched_seconds = ?, completed = ?, last_watched_at = ?`,
            [userId, contentId, watchedSeconds, completed ? 1 : 0, Date.now(),
             watchedSeconds, completed ? 1 : 0, Date.now()]);
    },
};

// ── Ambient Images ────────────────────────────────────────────────────────
const ambientImages = {
    list: ({ tier, limit = 50 } = {}) => {
        if (tier === 'observer') {
            return query('SELECT * FROM ambient_images ORDER BY sort_order ASC, id DESC LIMIT ?', [limit]);
        }
        return query('SELECT * FROM ambient_images WHERE tier = "free" ORDER BY sort_order ASC, id DESC LIMIT ?', [limit]);
    },
    upsert: async (data) => {
        if (data.id) {
            await execute(`UPDATE ambient_images SET slug=?, title=?, description=?, image_url=?,
                thumbnail_url=?, credit_line=?, source=?, tier=?, object_name=?, tags=?,
                is_featured=?, sort_order=? WHERE id=?`,
                [data.slug, data.title, data.description, data.imageUrl, data.thumbnailUrl,
                 data.creditLine, data.source, data.tier, data.objectName,
                 JSON.stringify(data.tags ?? []), data.isFeatured ? 1 : 0, data.sortOrder ?? 0, data.id]);
        } else {
            await execute(`INSERT INTO ambient_images
                (slug, title, description, image_url, thumbnail_url, credit_line, source, tier,
                 object_name, tags, is_featured, sort_order, created_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                [data.slug, data.title, data.description, data.imageUrl, data.thumbnailUrl,
                 data.creditLine, data.source, data.tier, data.objectName,
                 JSON.stringify(data.tags ?? []), data.isFeatured ? 1 : 0, data.sortOrder ?? 0, Date.now()]);
        }
    },
    delete: id => execute('DELETE FROM ambient_images WHERE id = ?', [id]),
};

// ── Events log ────────────────────────────────────────────────────────────
const events = {
    log: ({ userId, type, event, data, source, ip } = {}) =>
        execute('INSERT INTO events (user_id, type, event, data, source, ip_address, ts) VALUES (?,?,?,?,?,?,?)',
            [userId ?? null, type ?? null, event ?? null,
             data ? JSON.stringify(data) : null, source ?? null, ip ?? null, Date.now()]),
};

module.exports = {
    runMigrations,
    query, queryOne, execute, pool,
    users, subscriptions, devices, content, skyEvents, watchHistory, ambientImages, events,
};
