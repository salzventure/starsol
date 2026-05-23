'use strict';
// Resend integration with send logging. Falls back to console when API key is REPLACE_ME.

const { htmlToText } = require('./email_design');
const store = require('./store');

const RESEND_API_KEY  = process.env.RESEND_API_KEY  || 'REPLACE_ME';
const FROM_NOREPLY    = process.env.EMAIL_NOREPLY   || 'starsol-noreply@salzventure.com';
const FROM_SUPPORT    = process.env.EMAIL_SUPPORT   || 'starsol@salzventure.com';
const IS_STUB         = RESEND_API_KEY === 'REPLACE_ME';

if (IS_STUB) {
    console.warn('[email] RESEND_API_KEY not set — emails logged to console only');
}

async function sendEmail({ to, subject, html, userId, campaign, from }) {
    const fromAddr = from || FROM_NOREPLY;
    const text = htmlToText(html);

    if (IS_STUB) {
        console.log(`[email STUB] To:${to} | Subject:${subject} | Campaign:${campaign || 'n/a'}`);
        await logSend({ userId, campaign, to, subject, resendId: `stub_${Date.now()}`, status: 'stub' });
        return { ok: true, stub: true };
    }

    let resendId = null;
    try {
        const { Resend } = require('resend');
        const resend = new Resend(RESEND_API_KEY);
        const result = await resend.emails.send({ from: fromAddr, to, subject, html, text });
        resendId = result.data?.id || null;
        await logSend({ userId, campaign, to, subject, resendId, status: 'sent' });
        return { ok: true, resendId };
    } catch (err) {
        console.error('[email] send failed:', err.message);
        await logSend({ userId, campaign, to, subject, resendId, status: 'error' });
        throw err;
    }
}

async function logSend({ userId, campaign, to, subject, resendId, status }) {
    try {
        await store.execute(
            `INSERT INTO email_sends (user_id, campaign, email_address, subject, resend_id, status, sent_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [userId || null, campaign || null, to, subject, resendId || null, status || 'sent', Date.now()],
        );
    } catch (err) {
        console.error('[email] log failed:', err.message);
    }
}

async function alreadySent(userId, campaign, withinMs) {
    const cutoff = withinMs ? Date.now() - withinMs : 0;
    const row = await store.queryOne(
        `SELECT id FROM email_sends
         WHERE user_id = ? AND campaign = ? AND sent_at > ? AND status NOT IN ('error')
         LIMIT 1`,
        [userId, campaign, cutoff],
    );
    return !!row;
}

module.exports = { sendEmail, logSend, alreadySent, IS_STUB, FROM_NOREPLY, FROM_SUPPORT };
