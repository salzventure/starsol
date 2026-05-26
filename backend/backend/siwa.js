// Sign In with Apple — native tvOS flow.
//
// Different from the web OAuth path in oauth.js:
//   Web:    Authorization Code flow → exchange code → id_token
//   Native: ASAuthorizationAppleIDCredential → identityToken (JWT, signed by Apple)
//
// The identity token is verified against Apple's public JWKS. No client_secret
// or code exchange needed — the token is the credential.
//
// Env vars:
//   APPLE_BUNDLE_ID   com.starsol.app.tvos — audience claim for native tokens
//                     (web OAuth uses APPLE_OAUTH_CLIENT_ID as audience instead)

'use strict';

const crypto  = require('crypto');
const jwt     = require('jsonwebtoken');
const { resolveUserForOauth } = require('./oauth');
const { issueToken } = require('./auth');

const BUNDLE_ID = process.env.APPLE_BUNDLE_ID || 'com.starsol.app.tvos';

// ── JWKS cache ────────────────────────────────────────────────────────
// Apple rotates keys infrequently; 1-hour TTL avoids per-request fetches
// while staying responsive to key rotation.
let _jwksCache = null;
let _jwksCacheAt = 0;
const JWKS_TTL = 60 * 60 * 1000;

async function fetchJWKS() {
    if (_jwksCache && Date.now() - _jwksCacheAt < JWKS_TTL) return _jwksCache;
    const r = await fetch('https://appleid.apple.com/auth/keys');
    if (!r.ok) throw new Error(`Apple JWKS fetch failed: ${r.status}`);
    _jwksCache = await r.json();
    _jwksCacheAt = Date.now();
    return _jwksCache;
}

async function verifyIdentityToken(identityToken) {
    // Decode header to locate the signing key by kid.
    const [headerB64] = identityToken.split('.');
    let header;
    try {
        header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
    } catch {
        throw new Error('malformed identity token header');
    }

    const jwks = await fetchJWKS();
    const jwk = (jwks.keys || []).find(k => k.kid === header.kid);
    if (!jwk) throw new Error(`no Apple JWKS key for kid=${header.kid}`);

    // crypto.createPublicKey accepts JWK format natively in Node 15+.
    const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });

    // Verify signature, issuer, and audience. Apple native tokens use
    // the bundle ID as audience (web OAuth uses the Services ID instead).
    return jwt.verify(identityToken, publicKey, {
        algorithms: ['RS256'],
        issuer:     'https://appleid.apple.com',
        audience:   BUNDLE_ID,
    });
}

// POST /api/auth/siwa
// Body: { identityToken: string, fullName?: string }
// Returns: { token, user }
async function handler(req, res) {
    const { identityToken, fullName } = req.body || {};
    if (!identityToken || typeof identityToken !== 'string') {
        return res.status(400).json({ error: 'identityToken required' });
    }

    let claims;
    try {
        claims = await verifyIdentityToken(identityToken);
    } catch (err) {
        console.error('[siwa] identity token verification failed:', err.message);
        return res.status(401).json({ error: 'invalid identity token' });
    }

    const appleSub = claims.sub; // stable Apple user ID
    const email    = claims.email;

    if (!appleSub) {
        return res.status(401).json({ error: 'identity token missing sub claim' });
    }

    // Apple sometimes withholds email on subsequent sign-ins after the user
    // has already authorized the app. resolveUserForOauth handles the no-email
    // case by doing a direct identity lookup via (provider, sub).
    const profile = {
        sub:            appleSub,
        email:          email || null,
        emailVerified:  !!email && !email.endsWith('@privaterelay.appleid.com'),
        isPrivateRelay: email ? email.endsWith('@privaterelay.appleid.com') : false,
        name:           fullName || null,
    };

    let result;
    try {
        result = await resolveUserForOauth({ provider: 'apple', profile });
    } catch (err) {
        console.error('[siwa] resolveUserForOauth failed:', err.message);
        return res.status(500).json({ error: 'account resolution failed' });
    }

    const user = result.user;
    const publicUser = { id: user.id, email: user.email, name: user.name, plan: user.plan };
    return res.json({
        token: issueToken(user),
        user:  publicUser,
    });
}

module.exports = { handler };
