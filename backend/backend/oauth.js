// Social-login scaffold for Google + Apple. Provider keys are read from env
// at request time so an unset provider returns a clear 501 instead of
// throwing at module load.
//
// Env vars (none required to boot — providers self-disable when unset):
//   GOOGLE_CLIENT_ID (Google Identity Services web client ID)
//   APPLE_OAUTH_CLIENT_ID  (the Services ID, not the App ID)
//   APPLE_OAUTH_TEAM_ID, APPLE_OAUTH_KEY_ID
//   APPLE_OAUTH_PRIVATE_KEY  (the .p8 contents, PEM-formatted, with \n literals
//                             OK — we strip them)
//   APP_URL  (e.g. https://starsol.app — defaults to SITE constant)
//
// State is signed JWTs (HS256) so we don't need a server-side session store.
// They carry the original `next=` URL so the user lands where they tried to
// go after auth.
//
// Linking strategy on callback:
//   1. If oauth_identities row exists for (provider, sub) → load that user.
//   2. Else if a StarSol user exists for the verified provider email → link
//      the identity to it (auto-link). Skip auto-link for Apple "private
//      relay" addresses (they're not verifiable as the user's real address)
//      and require explicit account creation instead.
//   3. Else create a new StarSol user with a random password (the user can
//      run /forgot to set one if they later want password login).

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const store = require('./store');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET env var is required');
const SITE = process.env.APP_URL || 'https://starsol.app';

function googleConfigured() {
    return !!process.env.GOOGLE_CLIENT_ID;
}
function appleConfigured() {
    return !!(process.env.APPLE_OAUTH_CLIENT_ID
              && process.env.APPLE_OAUTH_TEAM_ID
              && process.env.APPLE_OAUTH_KEY_ID
              && process.env.APPLE_OAUTH_PRIVATE_KEY);
}
function providerConfig() {
    return {
        google: googleConfigured(),
        apple:  appleConfigured(),
    };
}

function callbackUrl(provider) {
    return `${SITE}/api/auth/oauth/${provider}/callback`;
}

function signState({ provider, next, nonce, allowCreate = false }) {
    return jwt.sign(
        { provider, next: next || '/account', nonce: nonce || crypto.randomBytes(16).toString('hex'), allowCreate: allowCreate === true },
        JWT_SECRET,
        { expiresIn: '15m' },
    );
}
function verifyState(token) {
    try { return jwt.verify(token, JWT_SECRET); } catch (_) { return null; }
}

// ── Apple ────────────────────────────────────────────────────────────
function appleAuthUrl({ state }) {
    const params = new URLSearchParams({
        client_id:     process.env.APPLE_OAUTH_CLIENT_ID,
        redirect_uri:  callbackUrl('apple'),
        response_type: 'code',
        response_mode: 'form_post', // Apple requires form_post for email scope
        scope:         'name email',
        state,
    });
    return `https://appleid.apple.com/auth/authorize?${params}`;
}
function appleClientSecret() {
    // Apple's client_secret is a JWT signed with your private .p8 key.
    // 6-month max validity per Apple — we mint per-request to avoid caching.
    const key = (process.env.APPLE_OAUTH_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    return jwt.sign(
        {
            iss: process.env.APPLE_OAUTH_TEAM_ID,
            sub: process.env.APPLE_OAUTH_CLIENT_ID,
            aud: 'https://appleid.apple.com',
        },
        key,
        {
            algorithm: 'ES256',
            keyid:     process.env.APPLE_OAUTH_KEY_ID,
            expiresIn: '5m',
        },
    );
}
async function appleExchange(code) {
    const body = new URLSearchParams({
        code,
        client_id:     process.env.APPLE_OAUTH_CLIENT_ID,
        client_secret: appleClientSecret(),
        redirect_uri:  callbackUrl('apple'),
        grant_type:    'authorization_code',
    });
    const r = await fetch('https://appleid.apple.com/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });
    if (!r.ok) throw new Error(`apple token exchange failed: ${r.status}`);
    const tok = await r.json();
    if (!tok.id_token) throw new Error('apple response missing id_token');
    const claims = jwt.decode(tok.id_token);
    if (!claims || !claims.sub) throw new Error('apple id_token missing sub');
    const email = (claims.email || '').toLowerCase();
    return {
        sub:            claims.sub,
        email,
        emailVerified:  !!claims.email_verified,
        // Apple "Hide My Email" returns @privaterelay.appleid.com — flag it
        // so the linker doesn't auto-merge with a password account.
        isPrivateRelay: email.endsWith('@privaterelay.appleid.com'),
        name:           null, // Apple only sends name on first authorization, in form-post body
    };
}

// ── Identity linking ──────────────────────────────────────────────────
async function findIdentity(provider, sub) {
    const [rows] = await store.pool.query(
        'SELECT user_id, email_at_link FROM oauth_identities WHERE provider = ? AND provider_user_id = ?',
        [provider, sub],
    );
    return rows[0] ? { userId: Number(rows[0].user_id), emailAtLink: rows[0].email_at_link } : null;
}
async function linkIdentity({ provider, sub, userId, email }) {
    const now = Date.now();
    await store.pool.query(
        `INSERT INTO oauth_identities (provider, provider_user_id, user_id, email_at_link, created_at, last_used_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE last_used_at = VALUES(last_used_at)`,
        [provider, sub, userId, email || null, now, now],
    );
}
async function touchIdentity(provider, sub) {
    await store.pool.query(
        'UPDATE oauth_identities SET last_used_at = ? WHERE provider = ? AND provider_user_id = ?',
        [Date.now(), provider, sub],
    );
}

// Resolve an oauth profile to a StarSol user. Side-effects: may create or
// link rows. Returns the user object.
async function resolveUserForOauth({ provider, profile, allowCreate = false }) {
    // 1. Direct identity hit
    const existing = await findIdentity(provider, profile.sub);
    if (existing) {
        await touchIdentity(provider, profile.sub);
        return { user: await store.users.findById(existing.userId), created: false, linked: false };
    }
    // 2. Auto-link by verified email (skip for Apple private relay)
    const canAutoLink = profile.email && profile.emailVerified && !profile.isPrivateRelay;
    if (canAutoLink) {
        const byEmail = await store.users.findByEmail(profile.email);
        if (byEmail) {
            await linkIdentity({ provider, sub: profile.sub, userId: byEmail.id, email: profile.email });
            return { user: byEmail, created: false, linked: true };
        }
    }
    // 3. Create a new account. Random unguessable password — the user can
    //    run /forgot if they ever want password login.
    if (allowCreate !== true) throw new Error('oauth_account_creation_not_verified');
    if (!profile.email) throw new Error('provider returned no email — cannot create account');
    const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
    const now = Date.now();
    const [result] = await store.pool.query(
        'INSERT INTO users (email, password_hash, name, plan, created_at) VALUES (?,?,?,?,?)',
        [profile.email, passwordHash, profile.name || profile.email.split('@')[0], 'free', now],
    );
    const created = await store.users.findById(result.insertId);
    await linkIdentity({ provider, sub: profile.sub, userId: created.id, email: profile.email });
    return { user: created, created: true, linked: false };
}

module.exports = {
    providerConfig,
    googleConfigured,
    appleConfigured,
    appleAuthUrl,
    appleExchange,
    appleClientSecret,
    signState,
    verifyState,
    resolveUserForOauth,
    callbackUrl,
};
