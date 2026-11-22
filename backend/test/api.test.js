'use strict';
// BizYour API regression suite — runs against a throwaway SQLite database
// seeded with the demo shops. Run: `npm test` (from backend/).
//
// Covers: demo canonical numbers, auth + rate limiting, session expiry,
// cross-business isolation, role guards, billing math + stock movement,
// Mart quote-accept race safety, CSV export, XLSX import (exceljs).

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'bizyour-test-'));
const PORT = 4300 + Math.floor(Math.random() * 500);
const BASE = `http://127.0.0.1:${PORT}`;
// TEST_DATABASE_URL=postgres://… runs the same suite against Postgres (cloud mode);
// it must point at an EMPTY throwaway database.
const PG_URL = process.env.TEST_DATABASE_URL || '';
const ENV = { ...process.env, BOS_DATA_DIR: DATA, PORT: String(PORT), DATABASE_URL: PG_URL, NODE_NO_WARNINGS: '1' };
let srv;

async function api(method, p, { token, body, headers } = {}) {
  const r = await fetch(BASE + p, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(headers || {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* csv etc */ }
  return { status: r.status, json, text, headers: r.headers };
}
// Each login comes from a distinct fake client IP so the per-IP limiter
// only bites in the test that is about rate limiting.
let ipSeq = 10;
async function login(identifier, password = 'demo1234') {
  const r = await api('POST', '/api/auth/login', { body: { identifier, password }, headers: { 'X-Forwarded-For': `10.0.0.${ipSeq++}` } });
  assert.equal(r.status, 200, `login ${identifier}: ${r.text}`);
  return r.json.token;
}

before(async () => {
  execFileSync(process.execPath, ['seed-demo.js'], { cwd: ROOT, env: ENV, stdio: 'ignore' });
  execFileSync(process.execPath, ['seed-mart-demo.js'], { cwd: ROOT, env: ENV, stdio: 'ignore' });
  srv = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: ENV, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    try { const r = await fetch(BASE + '/api/health'); if (r.ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('server did not start');
});
after(() => { if (srv) srv.kill(); fs.rmSync(DATA, { recursive: true, force: true }); });

test('health reports the right mode and security headers are present', async () => {
  const r = await api('GET', '/api/health');
  assert.equal(r.json.mode, PG_URL ? 'cloud' : 'local');
  assert.equal(r.headers.get('x-powered-by'), null);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(r.headers.get('x-frame-options'));
});

test('logo files used by emails and the Hisab page are served at /brand', async () => {
  for (const f of ['bizyour-mark-512.png', 'favicon-32.png', 'apple-touch-icon.png']) {
    const r = await fetch(BASE + '/brand/' + f);
    assert.equal(r.status, 200, f);
    assert.match(r.headers.get('content-type') || '', /image\/png/, f);
  }
});

test('demo canonical numbers are unchanged', async () => {
  const t = await login('demo@businessos.app');
  const dash = await api('GET', '/api/dashboard-summary', { token: t });
  assert.equal(dash.json.todays_sale, 1128);
  assert.equal(dash.json.total_pending_collection, 1620);
  const fin = await api('GET', '/api/dashboard-finance', { token: t });
  assert.equal(fin.json.todays_net_profit, 30);
  const rep = await api('GET', '/api/reports/summary?period=month', { token: t });
  assert.equal(rep.json.pending_supplier, 2300);
  assert.equal(rep.json.stock_value, 22051);
});

test('wrong password gives one generic 401; login is rate limited per account', async () => {
  const ident = 'verma@bizyour.demo';
  let last;
  for (let i = 0; i < 12; i++) {
    last = await api('POST', '/api/auth/login', { body: { identifier: ident, password: 'nope' }, headers: { 'X-Forwarded-For': `10.9.${i}.1` } });
    if (i === 0) assert.equal(last.status, 401);
  }
  assert.equal(last.status, 429);
  assert.equal(last.json.error, 'too_many_requests');
  assert.ok(Number(last.headers.get('retry-after')) > 0);
});

test('new passwords need 8+ characters', async () => {
  const r = await api('POST', '/api/auth/signup', { body: { name: 'X', email: 'x@example.com', password: 'short1', mobile: '9000000001' }, headers: { 'X-Forwarded-For': '10.8.0.1' } });
  assert.equal(r.status, 400);
  assert.equal(r.json.code, 'password_too_short');
});

test('expired sessions are refused', async () => {
  const t = await login('saffron@bizyour.demo');
  if (PG_URL) {
    const { Client } = require('pg');
    const c = new Client({ connectionString: PG_URL });
    await c.connect();
    await c.query("UPDATE sessions SET created_at = '2000-01-01 00:00:00' WHERE token = $1", [t]);
    await c.end();
  } else {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(path.join(DATA, 'business-os.db'));
    db.prepare("UPDATE sessions SET created_at = '2000-01-01 00:00:00' WHERE token = ?").run(t);
    db.close();
  }
  const r = await api('GET', '/api/me', { token: t });
  assert.equal(r.status, 401);
  assert.equal(r.json.error, 'session_expired');
});

// Raw SQL against the test database (SQLite file or Postgres).
async function rawSql(sqliteSql, pgSql, params) {
  if (PG_URL) {
    const { Client } = require('pg');
    const c = new Client({ connectionString: PG_URL });
    await c.connect(); await c.query(pgSql, params); await c.end();
  } else {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(path.join(DATA, 'business-os.db'));
    db.prepare(sqliteSql).run(...params); db.close();
  }
}

test('expired Workspace trial is read-only, but Business Mart stays free', async () => {
  const t = await login('rice@bizyour.demo');
  const me = (await api('GET', '/api/me', { token: t })).json;
  const bid = me.business.id;
  // make sure a subscription row exists, then push its trial and grace into the past
  await api('GET', '/api/subscription', { token: t });
  await rawSql("UPDATE subscriptions SET trial_ends_at = '2000-01-01 00:00:00', paid_until = NULL WHERE business_id = ?",
    "UPDATE subscriptions SET trial_ends_at = '2000-01-01 00:00:00', paid_until = NULL WHERE business_id = $1", [bid]);
  const sub = (await api('GET', '/api/subscription', { token: t })).json.subscription;
  assert.equal(sub.read_only, true, JSON.stringify(sub));
  const ws = await api('POST', '/api/customers', { token: t, body: { name: 'Blocked Customer' } });
  assert.equal(ws.status, 403);
  assert.equal(ws.json.error, 'subscription_expired');
  const mart = await api('POST', '/api/mart/inquiries', { token: t, body: { product: 'Poha 1kg', category: 'Staples', qty: 50, unit: 'pack', city: 'Delhi' } });
  assert.equal(mart.status, 201, mart.text);
  assert.equal((await api('GET', '/api/customers', { token: t })).status, 200); // reads still work
});

test('one business cannot read or change another business’s data', async () => {
  const a = await login('demo@businessos.app');
  const b = await login('fresh@bizyour.demo');
  const prods = await api('GET', '/api/products', { token: a });
  const pid = prods.json.products[0].id;
  assert.equal((await api('PUT', `/api/products/${pid}`, { token: b, body: { name: 'hacked' } })).status, 404);
  assert.equal((await api('DELETE', `/api/products/${pid}`, { token: b })).status, 404);
  const cust = await api('GET', '/api/customers', { token: a });
  const cid = cust.json.customers[0].id;
  assert.equal((await api('GET', `/api/customers/${cid}`, { token: b })).status, 404);
  const inv = await api('GET', '/api/invoices', { token: a });
  assert.equal((await api('GET', `/api/invoices/${inv.json.invoices[0].id}`, { token: b })).status, 404);
  const s = await api('GET', '/api/search?q=a', { token: b });
  assert.equal(s.json.products.filter((p) => p.name === prods.json.products[0].name && p.id === pid).length, 0);
});

test('billing-only staff cannot see finance or stock', async () => {
  const t = await login('counter@businessos.app', 'staff1234');
  assert.equal((await api('GET', '/api/dashboard-finance', { token: t })).status, 403);
  assert.equal((await api('GET', '/api/reports/summary', { token: t })).status, 403);
  assert.equal((await api('GET', '/api/products', { token: t })).status, 403);
  assert.equal((await api('GET', '/api/billing-products', { token: t })).status, 200);
});

test('a bill uses GST-inclusive math and moves stock', async () => {
  const t = await login('demo@businessos.app');
  const before = (await api('GET', '/api/billing-products', { token: t })).json.products;
  const cheeni = before.find((p) => p.name.startsWith('Cheeni'));
  const r = await api('POST', '/api/invoices', { token: t, body: { items: [{ product_id: cheeni.id, qty: 2 }], paid_amount: 90, payment_mode: 'UPI' } });
  assert.equal(r.status, 201, r.text);
  const inv = r.json.invoice;
  assert.equal(inv.total, 90);
  // 5% inclusive: 90 × 5/105 = 4.2857 → 4.29
  assert.equal(inv.gst_amount, 4.29);
  assert.equal(inv.status, 'paid');
  const after = (await api('GET', '/api/billing-products', { token: t })).json.products;
  assert.equal(after.find((p) => p.id === cheeni.id).stock_qty, cheeni.stock_qty - 2);
  const out = after.find((p) => p.stock_qty === 0);
  const bad = await api('POST', '/api/invoices', { token: t, body: { items: [{ product_id: out.id, qty: 1 }] } });
  assert.equal(bad.status, 400);
  assert.equal(bad.json.error, 'insufficient_stock');
});

test('two concurrent accepts on one inquiry create exactly one order', async () => {
  const buyer = await login('demo@businessos.app');
  const inqs = (await api('GET', '/api/mart/inquiries', { token: buyer })).json;
  const list = inqs.inquiries || inqs.items || inqs;
  const withQuotes = list.find((i) => i.new_quotes >= 2 && i.status === 'open');
  assert.ok(withQuotes, 'seed has an open inquiry with several quotes');
  const detail = (await api('GET', `/api/mart/inquiries/${withQuotes.id}`, { token: buyer })).json;
  const quotes = (detail.quotes || []).filter((q) => q.status === 'sent');
  assert.ok(quotes.length >= 2);
  const [r1, r2] = await Promise.all([
    api('POST', `/api/mart/quotes/${quotes[0].id}/accept`, { token: buyer }),
    api('POST', `/api/mart/quotes/${quotes[1].id}/accept`, { token: buyer })
  ]);
  const codes = [r1.status, r2.status].sort();
  assert.equal(codes.filter((c) => c === 201).length, 1, `got ${codes}`);
  const orders = (await api('GET', '/api/mart/orders?role=buyer', { token: buyer })).json;
  const all = orders.orders || orders;
  assert.equal(all.filter((o) => (o.inquiry_id || (o.inquiry && o.inquiry.id)) === withQuotes.id).length, 1);
});

test('login locks in the database after 5 wrong tries, correct password included', async () => {
  // Founder rule (2026-11-22): the DB-backed lockout sits behind the
  // in-memory limiter — 5 failures on one identifier lock it for
  // 15 minutes, and while locked even the right password gets a 429.
  const ident = 'gupta@bizyour.demo';
  let last;
  for (let i = 0; i < 5; i++) {
    last = await api('POST', '/api/auth/login', { body: { identifier: ident, password: 'nope' }, headers: { 'X-Forwarded-For': `10.7.0.${i + 1}` } });
    assert.equal(last.status, 401);
  }
  last = await api('POST', '/api/auth/login', { body: { identifier: ident, password: 'demo1234' }, headers: { 'X-Forwarded-For': '10.7.0.9' } });
  assert.equal(last.status, 429);
  assert.equal(last.json.error, 'too_many_attempts');
  assert.ok(Number(last.json.retry_after_min) >= 1);
});

test('two-stage workflow: account opens Mart buying, shop setup starts the trial', async () => {
  // Build a verified account directly (empty business, no pending OTP),
  // the state verify-otp leaves behind under the two-stage rule.
  const bcrypt = require('bcryptjs');
  const hash = bcrypt.hashSync('password123', 10);
  if (PG_URL) {
    const { Client } = require('pg');
    const c = new Client({ connectionString: PG_URL });
    await c.connect();
    const b = await c.query("INSERT INTO businesses (name, owner_name) VALUES ('', 'Stage Owner') RETURNING id");
    await c.query("INSERT INTO users (business_id, name, email, password_hash, role, access) VALUES ($1, 'Stage Owner', 'stage@bizyour.demo', $2, 'owner', 'all')", [b.rows[0].id, hash]);
    await c.end();
  } else {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(path.join(DATA, 'business-os.db'));
    const b = db.prepare("INSERT INTO businesses (name, owner_name) VALUES ('', 'Stage Owner')").run();
    db.prepare("INSERT INTO users (business_id, name, email, password_hash, role, access) VALUES (?, 'Stage Owner', 'stage@bizyour.demo', ?, 'owner', 'all')").run(b.lastInsertRowid, hash);
    db.close();
  }
  const t = await login('stage@bizyour.demo', 'password123');
  const me = (await api('GET', '/api/me', { token: t })).json;
  assert.equal(me.business.workspace_active, false);
  assert.equal(me.business.setup_complete, false);
  // Workspace locked, Mart buying open, selling locked, no trial yet.
  const ws = await api('GET', '/api/dashboard-summary', { token: t });
  assert.equal(ws.status, 403); assert.equal(ws.json.error, 'workspace_not_setup');
  assert.equal((await api('GET', '/api/mart/listings', { token: t })).status, 200);
  const sell = await api('POST', '/api/mart/listings', { token: t, body: { name: 'X', category: 'Staples', unit: 'kg', price: 10, moq: 1 } });
  assert.equal(sell.status, 403); assert.equal(sell.json.error, 'workspace_not_setup');
  const sub0 = (await api('GET', '/api/subscription', { token: t })).json.subscription;
  assert.equal(sub0.status, 'none'); assert.equal(sub0.read_only, false);
  // Activation validates, then starts the 30-day trial.
  const bad = await api('POST', '/api/workspace/activate', { token: t, body: { name: 'Stage Kirana', category: 'kirana', phone: '9812345670', address: 'Shop 1, Test Road', pincode: '11001', city: 'Delhi', state: 'Delhi' } });
  assert.equal(bad.status, 400); assert.equal(bad.json.error, 'invalid_pincode');
  const act = await api('POST', '/api/workspace/activate', { token: t, body: { name: 'Stage Kirana', category: 'kirana', phone: '9812345670', address: 'Shop 1, Test Road', pincode: '110001', city: 'Delhi', state: 'Delhi', gst_enabled: false } });
  assert.equal(act.status, 200, act.text);
  assert.equal(act.json.business.workspace_active, true);
  assert.equal(act.json.subscription.status, 'trial');
  const days = (Date.parse(act.json.subscription.trial_ends_at.replace(' ', 'T') + 'Z') - Date.now()) / 86400000;
  assert.ok(days > 29 && days <= 30.01, `trial days ${days}`);
  assert.equal((await api('GET', '/api/dashboard-summary', { token: t })).status, 200);
});

test('CSV export works and XLSX import previews via exceljs', async () => {
  const t = await login('demo@businessos.app');
  const csv = await api('GET', '/api/export/products', { token: t });
  assert.equal(csv.status, 200);
  assert.match(csv.text, /Atta 10kg/);
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Items');
  ws.addRow(['Item Name', 'Sale Price', 'Purchase Price', 'Opening Stock']);
  ws.addRow(['Test Biscuit', 10, 8, 50]);
  const b64 = Buffer.from(await wb.xlsx.writeBuffer()).toString('base64');
  const r = await api('POST', '/api/import/products/preview', { token: t, body: { format: 'xlsx', content: b64 } });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.valid_count, 1);
  assert.ok(JSON.stringify(r.json).includes('Test Biscuit'));
});
