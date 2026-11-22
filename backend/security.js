'use strict';
// Security helpers — no external dependencies.
//
// 1. rateLimit(): fixed-window, in-memory limiter. Good for one server
//    process (local mode, or a single Render instance). If BizYour ever
//    runs several instances behind a load balancer, move the counters to
//    the database or Redis — documented in docs/05-ARCHITECTURE.md.
// 2. securityHeaders(): baseline response headers for every request.
// 3. Session TTL helpers (absolute expiry, default 30 days).

const buckets = new Map(); // key -> { count, resetAt }

function hit(key, limit, windowMs) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count += 1;
  return { ok: b.count <= limit, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
}

// Periodic cleanup so the map cannot grow without bound.
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}, 60 * 1000).unref();

function clientIp(req) {
  // Behind Render/Vercel the real client is the first X-Forwarded-For hop.
  // Express's req.ip honours this only when 'trust proxy' is set (server.js).
  return req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
}

// rules: [{ name, limit, windowMs, key: (req) => string|null }]
// A null key skips that rule (e.g. no email in the body).
function rateLimit(rules) {
  return (req, res, next) => {
    if (process.env.RATE_LIMIT_DISABLED === '1') return next();
    for (const r of rules) {
      const k = r.key(req);
      if (!k) continue;
      const out = hit(`${r.name}:${k}`, r.limit, r.windowMs);
      if (!out.ok) {
        res.setHeader('Retry-After', String(out.retryAfter));
        return res.status(429).json({ error: 'too_many_requests', retry_after: out.retryAfter });
      }
    }
    next();
  };
}

const bodyEmail = (req) => {
  const b = req.body || {};
  const v = b.identifier !== undefined ? b.identifier : b.email;
  return v ? String(v).trim().toLowerCase() : null;
};

const MIN = 60 * 1000;
const limits = {
  // Login: per IP and per account. Generous enough for a busy shop with
  // several staff behind one NAT, tight enough to stop guessing.
  login: rateLimit([
    { name: 'login-ip', limit: 30, windowMs: 10 * MIN, key: clientIp },
    { name: 'login-id', limit: 10, windowMs: 15 * MIN, key: bodyEmail }
  ]),
  // OTP verification / password reset: per email and per IP.
  otpVerify: rateLimit([
    { name: 'otp-ip', limit: 30, windowMs: 15 * MIN, key: clientIp },
    { name: 'otp-id', limit: 10, windowMs: 15 * MIN, key: bodyEmail }
  ]),
  // Anything that sends an email (signup, resend, forgot): per IP.
  mailSend: rateLimit([
    { name: 'mail-ip', limit: 15, windowMs: 60 * MIN, key: clientIp }
  ]),
  // Public hisab links: unauthenticated, token-keyed — slow down scraping.
  publicRead: rateLimit([
    { name: 'pub-ip', limit: 120, windowMs: 5 * MIN, key: clientIp }
  ])
};

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  // API responses carry a shop's live data — never let a browser or a
  // shared cache store them.
  if (req.path && req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }
  next();
}

// Content-Security-Policy for the new web app (web/dist). Everything is
// bundled locally; the only outbound navigation is wa.me links, which are
// plain navigations and not governed by connect-src. connect-src allows the
// configured API origin for split deploys.
function webAppCsp(apiOrigin) {
  const connect = ["'self'"];
  if (apiOrigin) connect.push(apiOrigin);
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'", // React inline style attributes
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${connect.join(' ')}`,
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'"
  ].join('; ');
}

const SESSION_TTL_DAYS = Math.max(1, Number(process.env.SESSION_TTL_DAYS) || 30);

// created_at is stored as 'YYYY-MM-DD HH:MM:SS' UTC (SQLite) or a Date/ISO
// string (Postgres). Returns true when the session is older than the TTL.
function sessionExpired(createdAt) {
  if (!createdAt) return false;
  const t = createdAt instanceof Date
    ? createdAt.getTime()
    : Date.parse(String(createdAt).replace(' ', 'T') + (/[zZ+]/.test(String(createdAt).slice(10)) ? '' : 'Z'));
  if (!Number.isFinite(t)) return false;
  return Date.now() - t > SESSION_TTL_DAYS * 24 * 3600 * 1000;
}

function sessionCutoffTs() {
  const d = new Date(Date.now() - SESSION_TTL_DAYS * 24 * 3600 * 1000);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

const PASSWORD_MIN = 8;

module.exports = { limits, rateLimit, securityHeaders, webAppCsp, sessionExpired, sessionCutoffTs, SESSION_TTL_DAYS, PASSWORD_MIN, clientIp };
