'use strict';
// StarSol email design primitives. Email-safe: inline CSS only, 600px max.

const SITE         = process.env.APP_URL || 'https://starsol.app';
const COMPANY_NAME = 'Salzventure Technologies LLC';
const COMPANY_ADDR = 'PO Box 12393, Denver, CO 80212, USA';

// StarSol brand tokens — exact values from design handoff tokens.jsx
const T = {
    bg:        '#0a0d12',  // space1 — primary background
    card:      '#1a2029',  // space3 — elevated/cards
    border:    '#232a36',  // space4 — hairline borders
    text:      '#fbf3df',  // star100 — primary text (warm white)
    textBody:  '#c8b886',  // star300 — secondary text
    muted:     '#8c8773',  // text2
    footer:    '#4f4a3e',  // text3
    accent:    '#d4a44a',  // star500 — PRIMARY accent (buttons, focus, brand)
    accentBg:  'rgba(212,164,74,0.12)',
    ember:     '#c14a2a',  // LIVE indicator only
    aurora:    '#5da888',  // ISS/visible-tonight only
    fontUi:    `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`,
    fontMono:  `'SFMono-Regular',Menlo,Consolas,'Liberation Mono',monospace`,
    radiusBtn: 6,
};

function escHtml(s) {
    return String(s == null ? '' : s).replace(/[<>"'`&]/g, c => ({
        '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;', '&': '&amp;',
    }[c]));
}

function htmlToText(html) {
    return html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

// StarSol wordmark — star-gold star glyph + wordmark
function logoLockup() {
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td valign="middle" style="padding:0 10px 0 0;">
          <svg viewBox="0 0 36 36" width="28" height="28" xmlns="http://www.w3.org/2000/svg">
            <rect width="36" height="36" rx="8" fill="#111827"/>
            <polygon points="18,5 21.5,14 31,14 23.5,19.5 26.5,29 18,23.5 9.5,29 12.5,19.5 5,14 14.5,14"
              fill="${T.accent}" opacity="0.9"/>
          </svg>
        </td>
        <td valign="middle" style="font-family:${T.fontUi};font-size:20px;font-weight:800;letter-spacing:-0.02em;color:${T.text};">StarSol</td>
      </tr>
    </table>`;
}

function preheaderHtml(text) {
    return `<div style="display:none;font-size:1px;color:${T.bg};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">
        ${escHtml(text)}${'&nbsp;&zwnj;'.repeat(60)}
      </div>`;
}

function ctaButton(label, url) {
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;">
      <tr>
        <td align="left" bgcolor="${T.accent}" style="border-radius:${T.radiusBtn}px;">
          <a href="${url}" style="display:inline-block;padding:14px 28px;font-family:${T.fontUi};font-size:15px;font-weight:700;color:#080C14;text-decoration:none;border-radius:${T.radiusBtn}px;line-height:1;">
            ${escHtml(label)} &rarr;
          </a>
        </td>
      </tr>
    </table>`;
}

function divider() {
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0;">
      <tr><td style="border-top:1px solid ${T.border};font-size:0;line-height:0;">&nbsp;</td></tr>
    </table>`;
}

function featureBullet(text) {
    return `<p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:${T.textBody};padding-left:18px;">
      <span style="color:${T.accent};font-weight:700;margin-right:8px;">&#9733;</span>${escHtml(text)}
    </p>`;
}

// Full email wrapper — header + logo + body + footer
function wrap({ preheader, body, footerExtra }) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta http-equiv="X-UA-Compatible" content="IE=edge"/>
<title>StarSol</title>
</head>
<body style="margin:0;padding:0;background-color:${T.bg};font-family:${T.fontUi};">
${preheader ? preheaderHtml(preheader) : ''}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${T.bg};padding:40px 20px;">
  <tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;">

      <!-- Header -->
      <tr><td style="padding:0 0 32px 0;">${logoLockup()}</td></tr>

      <!-- Body card -->
      <tr><td style="background-color:${T.card};border-radius:12px;padding:40px;border:1px solid ${T.border};">
        ${body}
      </td></tr>

      <!-- Footer -->
      <tr><td style="padding:32px 0 0 0;">
        ${footerExtra || ''}
        <p style="margin:0;font-size:12px;color:${T.footer};line-height:1.6;">
          &copy; ${new Date().getFullYear()} ${escHtml(COMPANY_NAME)}<br/>
          ${escHtml(COMPANY_ADDR)}<br/>
          <a href="${SITE}" style="color:${T.muted};text-decoration:none;">starsol.app</a>
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function h1(text) {
    return `<h1 style="margin:0 0 16px;font-size:26px;font-weight:800;color:${T.text};letter-spacing:-0.02em;line-height:1.2;">${escHtml(text)}</h1>`;
}
function p(text) {
    return `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:${T.textBody};">${escHtml(text)}</p>`;
}
function pHtml(html) {
    return `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:${T.textBody};">${html}</p>`;
}

module.exports = { T, SITE, escHtml, htmlToText, logoLockup, preheaderHtml, ctaButton, divider, featureBullet, wrap, h1, p, pHtml };
