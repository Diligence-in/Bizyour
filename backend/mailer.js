// Business OS v3 — SaaS Stage 2: tiny mailer for OTP / account emails.
// Config comes ONLY from the environment (see .env.example):
//   MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS, MAIL_FROM
// (SMTP_* is accepted as an alias prefix for the same five values.)
//
// HONESTY RULE (founder's): when no mail config exists, mail is NOT sent.
// The message (with the OTP) is written to the server console log ONLY —
// clearly marked [DEV-MAIL] — and sendMail reports mail_configured:false.
// Callers surface that flag in API responses; the OTP itself is NEVER put
// in an API response, configured or not.
function envFirst(...names) {
  for (const n of names) {
    const v = process.env[n];
    if (v !== undefined && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

function mailConfig() {
  const host = envFirst('MAIL_HOST', 'SMTP_HOST');
  const user = envFirst('MAIL_USER', 'SMTP_USER');
  const pass = envFirst('MAIL_PASS', 'SMTP_PASS');
  const from = envFirst('MAIL_FROM', 'SMTP_FROM') || user;
  const port = Number(envFirst('MAIL_PORT', 'SMTP_PORT') || 587);
  return { host, user, pass, from, port, configured: !!(host && user && pass && from) };
}

let transporter = null;
function getTransporter(cfg) {
  if (transporter) return transporter;
  const nodemailer = require('nodemailer');
  transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465, // 465 = implicit TLS; 587/25 = STARTTLS upgrade
    auth: { user: cfg.user, pass: cfg.pass }
  });
  return transporter;
}

// Returns { sent, mail_configured }. Never throws for a config problem —
// a mail outage must not break signup; it just means no live mail.
// `html` is optional: when given, the mail goes out multipart (text + html)
// so plain-text clients keep working exactly as before.
async function sendMail(to, subject, text, html) {
  const cfg = mailConfig();
  if (!cfg.configured) {
    console.log(`[DEV-MAIL] (mail NOT configured — nothing was emailed) To: ${to} | Subject: ${subject} | ${text}`);
    return { sent: false, mail_configured: false };
  }
  try {
    const msg = { from: cfg.from, to, subject, text };
    if (html) msg.html = html;
    await getTransporter(cfg).sendMail(msg);
    return { sent: true, mail_configured: true };
  } catch (e) {
    console.error('mail send failed:', e && e.message ? e.message : e);
    return { sent: false, mail_configured: true };
  }
}

// Branded HTML for the OTP emails (signup verify + password reset).
// Email-client-safe on purpose: table layout, inline styles only, no
// external CSS. Looks complete even when images are blocked — the logo
// is decoration, the wordmark is real text.
function otpEmailHtml(code, purpose, ttlMin) {
  const isReset = purpose === 'reset';
  const heading = isReset ? 'Reset your password' : 'Verify your email address';
  const intro = isReset
    ? 'Enter this code in the app to set a new password for your BizYour account.'
    : 'Welcome to BizYour. Enter this code in the app to verify your email and finish setting up your account.';
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#F2F3F7;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F2F3F7;">
<tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#FFFFFF;border:1px solid #E3E6F0;border-radius:16px;overflow:hidden;">
<tr><td style="padding:24px 32px 18px 32px;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="vertical-align:middle;"><img src="https://www.bizyour.in/brand/bizyour-mark-512.png?v=c" width="46" height="46" alt="BizYour" style="display:block;border-radius:11px;"></td>
<td style="vertical-align:middle;padding-left:13px;"><span style="font-family:Arial,Helvetica,sans-serif;font-size:25px;font-weight:bold;color:#2B3A8F;letter-spacing:-0.3px;">BizYour</span><br><span style="font-family:Arial,Helvetica,sans-serif;font-size:10.5px;color:#8A8FA3;letter-spacing:2.2px;">BY DILIGENCE</span></td>
</tr></table>
</td></tr>
<tr><td style="height:4px;background-color:#3E7CB1;background:linear-gradient(90deg,#3ED6A5,#3E7CB1);font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:28px 32px 6px 32px;font-family:Arial,Helvetica,sans-serif;">
<div style="font-size:21px;font-weight:bold;color:#14181F;">${heading}</div>
<p style="margin:12px 0 0 0;font-size:14.5px;line-height:1.55;color:#4A4F63;">${intro}</p>
</td></tr>
<tr><td align="center" style="padding:22px 32px 4px 32px;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td align="center" style="background-color:#EEF0FA;border:1px solid #D5DAF2;border-radius:12px;padding:16px 34px;font-family:'Courier New',Courier,monospace;font-size:34px;font-weight:bold;letter-spacing:9px;color:#1D2650;">${code}</td>
</tr></table>
</td></tr>
<tr><td style="padding:16px 32px 0 32px;font-family:Arial,Helvetica,sans-serif;">
<p style="margin:0;font-size:13.5px;line-height:1.55;color:#4A4F63;">This code is valid for <b>${ttlMin} minutes</b>. Never share it with anyone — BizYour will never ask for your code on a call or message.</p>
<p style="margin:10px 0 0 0;font-size:13.5px;line-height:1.55;color:#4A4F63;">If you did not request this, you can safely ignore this email — your account stays secure.</p>
</td></tr>
<tr><td style="padding:26px 32px 0 32px;"><div style="border-top:1px solid #E7E9F2;font-size:0;">&nbsp;</div></td></tr>
<tr><td align="center" style="padding:16px 32px 24px 32px;font-family:Arial,Helvetica,sans-serif;">
<div style="font-size:13px;color:#14181F;"><b>BizYour</b> by <b>DILIGENCE</b></div>
<div style="font-size:12.5px;color:#8A8FA3;margin-top:3px;">Poora business. Ek hi app. &nbsp;·&nbsp; <a href="https://bizyour.in" style="color:#2B3A8F;text-decoration:none;">bizyour.in</a></div>
<div style="font-size:11.5px;color:#B4B8C9;margin-top:9px;">This is an automated email — please do not reply.</div>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

module.exports = { sendMail, mailConfig, otpEmailHtml };
