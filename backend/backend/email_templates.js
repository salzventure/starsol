'use strict';
// StarSol transactional + lifecycle email templates.
// Transactional: sent regardless of consent. Lifecycle: respect marketing_consent.

const d = require('./email_design');
const { sendEmail } = require('./email');

const SITE          = process.env.APP_URL    || 'https://starsol.app';
const ADMIN_EMAIL   = process.env.ADMIN_EMAIL || 'sjsalzberg@gmail.com';
const SUPPORT_EMAIL = process.env.EMAIL_SUPPORT || 'starsol@salzventure.com';

const CAMPAIGNS = {
    // Transactional
    'welcome':           { kind: 'transactional' },
    'email_verify':      { kind: 'transactional' },
    'password_reset':    { kind: 'transactional' },
    'upgraded_explorer': { kind: 'transactional' },
    'upgraded_observer': { kind: 'transactional' },
    'downgraded':        { kind: 'transactional' },
    'dunning_1':         { kind: 'transactional' },
    'dunning_2':         { kind: 'transactional' },
    'dunning_3':         { kind: 'transactional' },
    'renewal_reminder':  { kind: 'transactional', cooldownDays: 30 },
    'sky_alert':         { kind: 'transactional' },  // ISS pass / aurora — user opted in

    // Activation drip (free users)
    'D1_look_up':        { kind: 'marketing', delayDays: 1,  cooldownDays: 90 },
    'D3_ambient':        { kind: 'marketing', delayDays: 3,  cooldownDays: 90 },
    'D7_convert':        { kind: 'marketing', delayDays: 7,  cooldownDays: 90 },
    'D14_nudge':         { kind: 'marketing', delayDays: 14, cooldownDays: 90 },

    // Win-back
    'winback_1':         { kind: 'marketing', delayDays: 7,  cooldownDays: 180 },
    'winback_2':         { kind: 'marketing', delayDays: 30, cooldownDays: 180 },

    // Internal
    'admin_daily':       { kind: 'internal' },
};

// ── Welcome ───────────────────────────────────────────────────────────────

async function sendWelcome(user) {
    const html = d.wrap({
        preheader: 'The universe is waiting.',
        body: [
            d.h1('Welcome to StarSol.'),
            d.p(`Hi${user.name ? ` ${user.name}` : ''},`),
            d.p('You\'re now part of a small community of people who believe the night sky deserves more than a footnote.'),
            d.pHtml(`Your <strong style="color:${d.T.text};">free account</strong> includes:`),
            d.featureBullet('JWST gallery — 20 images from the Webb telescope'),
            d.featureBullet('7-day sky event calendar'),
            d.featureBullet('3 sample documentary episodes'),
            d.featureBullet('Ambient mode — 5 curated deep space images'),
            '<br/>',
            d.ctaButton('Explore StarSol', `${SITE}/`),
            d.divider(),
            d.pHtml(`Ready for the full sky? <a href="${SITE}/pricing" style="color:${d.T.accent};text-decoration:none;">See Explorer &amp; Observer plans</a> — from $39.99/yr.`),
        ].join(''),
    });
    return sendEmail({ to: user.email, subject: 'Welcome to StarSol', html, userId: user.id, campaign: 'welcome' });
}

// ── Email verification ────────────────────────────────────────────────────

async function sendEmailVerify(user, token) {
    const url = `${SITE}/api/auth/verify-email?token=${token}`;
    const html = d.wrap({
        preheader: 'Verify your StarSol email address.',
        body: [
            d.h1('Verify your email.'),
            d.p('Click below to confirm your address. This link expires in 24 hours.'),
            d.ctaButton('Verify Email', url),
            d.p('If you didn\'t create a StarSol account, ignore this email.'),
        ].join(''),
    });
    return sendEmail({ to: user.email, subject: 'Verify your StarSol email', html, userId: user.id, campaign: 'email_verify' });
}

// ── Password reset ────────────────────────────────────────────────────────

async function sendPasswordReset(user, token) {
    const url = `${SITE}/reset-password?token=${token}`;
    const html = d.wrap({
        preheader: 'Reset your StarSol password.',
        body: [
            d.h1('Reset your password.'),
            d.p('Someone requested a password reset for your StarSol account. Click below — this link expires in 1 hour.'),
            d.ctaButton('Reset Password', url),
            d.p('If you didn\'t request this, your account is safe — you can ignore this email.'),
        ].join(''),
    });
    return sendEmail({ to: user.email, subject: 'StarSol password reset', html, userId: user.id, campaign: 'password_reset' });
}

// ── Plan upgrade ──────────────────────────────────────────────────────────

async function sendUpgraded(user, plan) {
    const isObserver = plan === 'observer';
    const planLabel = isObserver ? 'Observer' : 'Explorer';
    const campaign = isObserver ? 'upgraded_observer' : 'upgraded_explorer';

    const html = d.wrap({
        preheader: `You're now on StarSol ${planLabel}. The full sky awaits.`,
        body: [
            d.h1(`You\'re on ${planLabel}.`),
            d.p(`Thank you. Your subscription is active and everything is unlocked.`),
            isObserver
                ? [
                    d.featureBullet('Geolocated ISS pass alerts — push to your phone'),
                    d.featureBullet('Aurora alerts when the KP index spikes'),
                    d.featureBullet('Early JWST image drops — before public release'),
                    d.featureBullet('8K ambient images — the full gallery'),
                  ].join('')
                : [
                    d.featureBullet('Full content library — documentaries, series, JWST gallery'),
                    d.featureBullet('Ambient mode — the complete image collection'),
                    d.featureBullet('Sky event calendar — 365 days ahead'),
                    d.featureBullet('Live events — launches, eclipses, JWST drops'),
                  ].join(''),
            '<br/>',
            d.ctaButton('Open StarSol', `${SITE}/`),
            d.divider(),
            d.pHtml(`Questions? <a href="mailto:${SUPPORT_EMAIL}" style="color:${d.T.accent};text-decoration:none;">${SUPPORT_EMAIL}</a>`),
        ].join(''),
    });
    return sendEmail({ to: user.email, subject: `You're on StarSol ${planLabel}`, html, userId: user.id, campaign });
}

// ── Downgrade ─────────────────────────────────────────────────────────────

async function sendDowngraded(user) {
    const html = d.wrap({
        preheader: 'Your StarSol subscription has ended.',
        body: [
            d.h1('Your subscription ended.'),
            d.p('Your StarSol account is now on the free plan. You\'ll keep access to the free library.'),
            d.ctaButton('Resubscribe', `${SITE}/pricing`),
            d.pHtml(`Need help? <a href="mailto:${SUPPORT_EMAIL}" style="color:${d.T.accent};text-decoration:none;">${SUPPORT_EMAIL}</a>`),
        ].join(''),
    });
    return sendEmail({ to: user.email, subject: 'Your StarSol subscription ended', html, userId: user.id, campaign: 'downgraded' });
}

// ── Payment failed (dunning) ──────────────────────────────────────────────

async function sendDunning(user, attempt) {
    const campaign = `dunning_${attempt}`;
    const isLast = attempt >= 3;
    const html = d.wrap({
        preheader: 'Action needed: StarSol payment failed.',
        body: [
            d.h1('Payment failed.'),
            d.p(`We couldn\'t charge your card for your StarSol subscription.`),
            isLast
                ? d.p('This is our final notice. If payment isn\'t updated, your account will revert to the free plan.')
                : d.p('We\'ll try again automatically — but please update your payment method to avoid interruption.'),
            d.ctaButton('Update Payment', `${SITE}/account`),
        ].join(''),
    });
    return sendEmail({ to: user.email, subject: 'StarSol payment failed — action needed', html, userId: user.id, campaign });
}

// ── Activation drip — D1 ──────────────────────────────────────────────────

async function sendD1LookUp(user) {
    const html = d.wrap({
        preheader: 'What\'s in your sky tonight?',
        body: [
            d.h1('What\'s up tonight?'),
            d.p('Your sky calendar is ready. Tonight\'s events are waiting in the app.'),
            d.p('Open StarSol on your TV → Tonight\'s Sky row → see what\'s visible from your location.'),
            d.ctaButton('Check Tonight\'s Sky', `${SITE}/`),
            d.divider(),
            d.pHtml(`<em style="color:${d.T.muted};font-size:13px;">Want the full calendar + ISS pass alerts? <a href="${SITE}/pricing" style="color:${d.T.accent};text-decoration:none;">Explorer is $39.99/yr.</a></em>`),
        ].join(''),
    });
    return sendEmail({ to: user.email, subject: 'What\'s in your sky tonight?', html, userId: user.id, campaign: 'D1_look_up' });
}

// ── D7 convert ────────────────────────────────────────────────────────────

async function sendD7Convert(user) {
    const html = d.wrap({
        preheader: 'The full sky — $39.99/yr.',
        body: [
            d.h1('One week in.'),
            d.p('You\'ve had a week with the free library. Here\'s what\'s waiting on Explorer:'),
            d.featureBullet('Full JWST + ESO + Hubble gallery — 500+ images'),
            d.featureBullet('Complete documentary library'),
            d.featureBullet('Ambient mode — your TV as a living art piece'),
            d.featureBullet('365-day sky event calendar'),
            d.featureBullet('Live events — eclipses, launches, JWST drops'),
            '<br/>',
            d.ctaButton('Get Explorer — $39.99/yr', `${SITE}/pricing`),
            d.pHtml(`<em style="color:${d.T.muted};font-size:13px;">$39.99/year. Cancel anytime. 7-day trial on new subscriptions.</em>`),
        ].join(''),
    });
    return sendEmail({ to: user.email, subject: 'The full sky — $39.99/yr', html, userId: user.id, campaign: 'D7_convert' });
}

// ── Admin daily digest ────────────────────────────────────────────────────

async function sendAdminDigest({ newUsers, totalUsers, planCounts }) {
    const rows = planCounts.map(r => `<tr><td style="padding:4px 12px 4px 0;color:${d.T.textBody};">${d.escHtml(r.plan)}</td><td style="padding:4px 0;color:${d.T.accent};font-weight:700;">${r.count}</td></tr>`).join('');
    const html = d.wrap({
        preheader: `StarSol daily: +${newUsers} users`,
        body: [
            d.h1(`Daily digest — +${newUsers} new users`),
            `<p style="color:${d.T.muted};font-size:14px;margin:0 0 20px;">Total users: <strong style="color:${d.T.text};">${totalUsers}</strong></p>`,
            `<table>${rows}</table>`,
            d.divider(),
            d.ctaButton('Open Admin', `${SITE}/admin`),
        ].join(''),
    });
    return sendEmail({ to: ADMIN_EMAIL, subject: `StarSol daily: +${newUsers} users`, html, campaign: 'admin_daily', from: process.env.EMAIL_NOREPLY });
}

module.exports = {
    CAMPAIGNS,
    sendWelcome,
    sendEmailVerify,
    sendPasswordReset,
    sendUpgraded,
    sendDowngraded,
    sendDunning,
    sendD1LookUp,
    sendD7Convert,
    sendAdminDigest,
};
