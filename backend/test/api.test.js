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

// ---------- 23 Nov 2026: setup guide, import everywhere, bill format ----------
test('shop setup needs only shop name and city; optional fields are still checked', async () => {
  const bcrypt = require('bcryptjs');
  const hash = bcrypt.hashSync('password123', 10);
  if (PG_URL) {
    const { Client } = require('pg');
    const c = new Client({ connectionString: PG_URL });
    await c.connect();
    const b = await c.query("INSERT INTO businesses (name, owner_name) VALUES ('', 'Guide Owner') RETURNING id");
    await c.query("INSERT INTO users (business_id, name, email, password_hash, role, access) VALUES ($1, 'Guide Owner', 'guide@bizyour.demo', $2, 'owner', 'all')", [b.rows[0].id, hash]);
    await c.end();
  } else {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(path.join(DATA, 'business-os.db'));
    const b = db.prepare("INSERT INTO businesses (name, owner_name) VALUES ('', 'Guide Owner')").run();
    db.prepare("INSERT INTO users (business_id, name, email, password_hash, role, access) VALUES (?, 'Guide Owner', 'guide@bizyour.demo', ?, 'owner', 'all')").run(b.lastInsertRowid, hash);
    db.close();
  }
  const t = await login('guide@bizyour.demo', 'password123');
  const noCity = await api('POST', '/api/workspace/activate', { token: t, body: { name: 'Guide Store' } });
  assert.equal(noCity.status, 400); assert.equal(noCity.json.error, 'city_required');
  const badPin = await api('POST', '/api/workspace/activate', { token: t, body: { name: 'Guide Store', city: 'Patna', pincode: '12' } });
  assert.equal(badPin.status, 400); assert.equal(badPin.json.error, 'invalid_pincode');
  const ok = await api('POST', '/api/workspace/activate', { token: t, body: { name: 'Guide Store', city: 'Patna' } });
  assert.equal(ok.status, 200, ok.text);
  assert.equal(ok.json.business.workspace_active, true);
  assert.equal(ok.json.business.category, 'other');
  // optional GST + UPI step
  const up = await api('PUT', '/api/business', { token: t, body: { gst_enabled: true, gstin: '10ABCDE1234F1Z5', upi_id: 'guide@okaxis', upi_payee_name: 'Guide Store' } });
  assert.equal(up.status, 200, up.text);
  assert.equal(up.json.business.upi_id, 'guide@okaxis');
  // customers step: quick-add rides the import pipeline (opening udhaar)
  const cust = await api('POST', '/api/import/customers/commit', { token: t, body: { content: 'Name,Phone,Opening Balance\nMohan,9811000001,450\n"Gupta, R.",,0\n', duplicate: 'skip' } });
  assert.equal(cust.status, 200, cust.text); assert.equal(cust.json.created, 2);
  const sum = (await api('GET', '/api/dashboard-summary', { token: t })).json;
  assert.equal(sum.total_pending_collection, 450);
  assert.ok(Array.isArray(sum.top_items));
});

test('expenses import: dates, categories and duplicates', async () => {
  const t = await login('demo@businessos.app');
  const csv = 'Date,Title,Category,Amount,Payment Mode,Notes\n01-11-2026,Shop rent,Rent,15000,Bank,Nov\n2026-11-05,Diwali lights,Decoration,1200,gpay,\n31-02-2026,Bad date,Other,10,Cash,\n05-11-2026,No amount,Other,,Cash,\n';
  const prev = await api('POST', '/api/import/expenses/preview', { token: t, body: { content: csv } });
  assert.equal(prev.status, 200, prev.text);
  assert.equal(prev.json.valid_count, 2); assert.equal(prev.json.error_count, 2);
  const lights = prev.json.sample.find((s) => s.name === 'Diwali lights');
  assert.equal(lights.category, 'Other'); assert.equal(lights.payment_mode, 'UPI'); assert.match(lights.notes, /Decoration/);
  const c1 = await api('POST', '/api/import/expenses/commit', { token: t, body: { content: csv } });
  assert.equal(c1.json.created, 2);
  const c2 = await api('POST', '/api/import/expenses/commit', { token: t, body: { content: csv } });
  assert.equal(c2.json.created, 0); assert.equal(c2.json.skipped, 2);
});

test('bill PDF renders with the UPI block', async () => {
  const t = await login('demo@businessos.app');
  await api('PUT', '/api/business', { token: t, body: { upi_id: 'sharma@okaxis' } });
  const bills = await api('GET', '/api/invoices', { token: t });
  const list = bills.json.invoices || bills.json;
  const inv = list.find((i) => i.kind !== 'opening') || list[0];
  const r = await fetch(`${BASE}/api/invoices/${inv.id}/pdf`, { headers: { Authorization: `Bearer ${t}` } });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'application/pdf');
  const buf = Buffer.from(await r.arrayBuffer());
  assert.equal(buf.slice(0, 4).toString(), '%PDF');
  assert.ok(buf.length > 5000);
});

test('a bill can be edited in place (items, paid, new due date)', async () => {
  const t = await login('demo@businessos.app');
  const prods = (await api('GET', '/api/billing-products', { token: t })).json.products;
  const p = prods.find((x) => x.stock_qty >= 3);
  const made = await api('POST', '/api/invoices', { token: t, body: { items: [{ product_id: p.id, qty: 1, sell_price: p.sell_price }], customer_id: 1, paid_amount: 0, due_date: '2026-12-01' } });
  assert.equal(made.status, 201, made.text);
  const id = made.json.invoice.id;
  const ed = await api('PUT', `/api/invoices/${id}`, { token: t, body: { items: [{ product_id: p.id, qty: 2, sell_price: p.sell_price }], customer_id: 1, paid_amount: p.sell_price, payment_mode: 'UPI', due_date: '2026-12-15' } });
  assert.equal(ed.status, 200, ed.text);
  assert.equal(ed.json.invoice.total, Math.round(p.sell_price * 2 * 100) / 100);
  assert.equal(ed.json.invoice.paid_amount, p.sell_price);
  assert.equal(ed.json.invoice.due_date, '2026-12-15');
  assert.equal(ed.json.invoice.bill_no, made.json.invoice.bill_no);
});

test('shop logo and photo are optional, validated, and the logo prints on the bill', async () => {
  const t = await login('demo@businessos.app');
  // 1x1 PNG
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const bad = await api('PUT', '/api/business', { token: t, body: { logo: 'data:text/html;base64,PHNjcmlwdD4=' } });
  assert.equal(bad.status, 400); assert.equal(bad.json.error, 'invalid_logo_image');
  const ok = await api('PUT', '/api/business', { token: t, body: { logo: png, shop_photo: png } });
  assert.equal(ok.status, 200, ok.text);
  assert.equal(ok.json.business.logo, png); assert.equal(ok.json.business.shop_photo, png);
  const bills = (await api('GET', '/api/invoices', { token: t })).json;
  const inv = (bills.invoices || bills)[0];
  const r = await fetch(`${BASE}/api/invoices/${inv.id}/pdf`, { headers: { Authorization: `Bearer ${t}` } });
  assert.equal(r.status, 200);
  const cleared = await api('PUT', '/api/business', { token: t, body: { logo: '', shop_photo: null } });
  assert.equal(cleared.json.business.logo, null); assert.equal(cleared.json.business.shop_photo, null);
});

test('bill PDF public link: mint, open without login, bad token 404, WhatsApp message carries it', async () => {
  const t = await login('demo@businessos.app');
  const prods = (await api('GET', '/api/billing-products', { token: t })).json.products;
  const p = prods.find((x) => x.stock_qty >= 3);
  const made = await api('POST', '/api/invoices', { token: t, body: { items: [{ product_id: p.id, qty: 1, sell_price: p.sell_price }], customer_id: 1, paid_amount: 0 } });
  assert.equal(made.status, 201, made.text);
  const id = made.json.invoice.id;
  // No auth on the mint endpoint: 401.
  assert.equal((await api('GET', `/api/invoices/${id}/bill-link`)).status, 401);
  // First mint returns a token + path; second mint returns the same token.
  const link1 = await api('GET', `/api/invoices/${id}/bill-link`, { token: t });
  assert.equal(link1.status, 200, link1.text);
  assert.match(link1.json.token, /^[0-9A-Za-z]{12}$/);
  assert.equal(link1.json.url_path, `/b/${link1.json.token}`);
  const link2 = await api('GET', `/api/invoices/${id}/bill-link`, { token: t });
  assert.equal(link2.json.token, link1.json.token);
  // The short public PDF opens with NO login, as a real PDF.
  const pub = await fetch(`${BASE}/b/${link1.json.token}`);
  assert.equal(pub.status, 200);
  assert.equal(pub.headers.get('content-type'), 'application/pdf');
  const buf = Buffer.from(await pub.arrayBuffer());
  assert.equal(buf.slice(0, 4).toString(), '%PDF');
  assert.ok(buf.length > 5000);
  // The old long path still serves the same bill (links already shared).
  const old = await fetch(`${BASE}/api/public/bill/${link1.json.token}/pdf`);
  assert.equal(old.status, 200);
  assert.equal(old.headers.get('content-type'), 'application/pdf');
  // A guessed token gets nothing.
  const bad = await fetch(`${BASE}/b/000000000000`);
  assert.equal(bad.status, 404);
  assert.equal((await bad.json()).error, 'link_not_found');
  // The WhatsApp text message carries the same short public PDF link.
  const wa = await api('GET', `/api/invoices/${id}/whatsapp-link`, { token: t });
  assert.equal(wa.status, 200, wa.text);
  assert.ok(wa.json.message.includes(`Bill PDF: https://www.bizyour.in/b/${link1.json.token}`), wa.json.message);
});

// ---------- 12-features pack (28 Nov 2026) ----------
// One fresh business for the feature tests (own product/customer/bill),
// plus one business per plan-tier scenario. Each uses ONE login on a
// fresh identifier — the demo account's 10-logins-per-15-min limit is
// already fully used by the older suite, so these tests never log in
// as demo@businessos.app.
async function makePackBusiness(email, ownerName, phone) {
  const bcrypt = require('bcryptjs');
  const hash = bcrypt.hashSync('password123', 10);
  let bizId;
  if (PG_URL) {
    const { Client } = require('pg');
    const c = new Client({ connectionString: PG_URL });
    await c.connect();
    const b = await c.query("INSERT INTO businesses (name, owner_name) VALUES ('', $1) RETURNING id", [ownerName]);
    bizId = b.rows[0].id;
    await c.query("INSERT INTO users (business_id, name, email, password_hash, role, access) VALUES ($1, $2, $3, $4, 'owner', 'all')", [bizId, ownerName, email, hash]);
    await c.end();
  } else {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(path.join(DATA, 'business-os.db'));
    const b = db.prepare("INSERT INTO businesses (name, owner_name) VALUES ('', ?)").run(ownerName);
    bizId = b.lastInsertRowid;
    db.prepare("INSERT INTO users (business_id, name, email, password_hash, role, access) VALUES (?, ?, ?, ?, 'owner', 'all')").run(bizId, ownerName, email, hash);
    db.close();
  }
  const t = await login(email, 'password123');
  const act = await api('POST', '/api/workspace/activate', { token: t, body: { name: 'Pack Kirana', category: 'kirana', phone, address: 'Shop 1, Test Road', pincode: '110001', city: 'Delhi', state: 'Delhi', gst_enabled: false } });
  assert.equal(act.status, 200, act.text);
  return { token: t, bizId };
}
async function expireTrial(bizId) {
  await rawSql("UPDATE subscriptions SET trial_ends_at = '2000-01-01 00:00:00', paid_until = NULL WHERE business_id = ?",
    "UPDATE subscriptions SET trial_ends_at = '2000-01-01 00:00:00', paid_until = NULL WHERE business_id = $1", [bizId]);
}
async function setPaidPeriod(bizId, code) {
  await rawSql("UPDATE subscriptions SET paid_until = '2030-01-01 00:00:00', plan_code = ? WHERE business_id = ?",
    "UPDATE subscriptions SET paid_until = '2030-01-01 00:00:00', plan_code = $1 WHERE business_id = $2", [code, bizId]);
}
let packBiz = null;
async function packSetup() {
  if (!packBiz) packBiz = await makePackBusiness('pack12@bizyour.demo', 'Pack Owner', '9812345671');
  return packBiz;
}

test('12-pack: credit limit + price tier round-trip, validation', async () => {
  const { token: t } = await packSetup();
  const c = await api('POST', '/api/customers', { token: t, body: { name: 'Limit Wala', phone: '9811111111', credit_limit: 5000, price_tier: 'wholesale' } });
  assert.equal(c.status, 201, c.text);
  assert.equal(c.json.customer.credit_limit, 5000);
  assert.equal(c.json.customer.price_tier, 'wholesale');
  const bad = await api('POST', '/api/customers', { token: t, body: { name: 'Bad Tier', price_tier: 'vip' } });
  assert.equal(bad.status, 400);
  const upd = await api('PUT', `/api/customers/${c.json.customer.id}`, { token: t, body: { credit_limit: 6000 } });
  assert.equal(upd.status, 200, upd.text);
  assert.equal(upd.json.customer.credit_limit, 6000);
  const plain = await api('POST', '/api/customers', { token: t, body: { name: 'Limit Plain' } });
  assert.equal(plain.status, 201, plain.text);
  assert.equal(plain.json.customer.credit_limit, null);
  assert.equal(plain.json.customer.price_tier, 'retail');
});

test('12-pack: wholesale price + custom fields + special rates', async () => {
  const { token: t } = await packSetup();
  const p = await api('POST', '/api/products', { token: t, body: { name: 'Test Biscuit 12pk', category: 'Grocery', unit: 'pack', buy_price: 60, sell_price: 100, wholesale_price: 80, stock_qty: 10, custom_fields: [{ key: 'Size', value: '12 pack' }, { key: 'Brand', value: 'Test' }] } });
  assert.equal(p.status, 201, p.text);
  assert.equal(p.json.product.wholesale_price, 80);
  assert.deepEqual(p.json.product.custom_fields, [{ key: 'Size', value: '12 pack' }, { key: 'Brand', value: 'Test' }]);
  const bad = await api('POST', '/api/products', { token: t, body: { name: 'Bad CF', buy_price: 1, sell_price: 2, custom_fields: [{ key: '', value: 'x' }] } });
  assert.equal(bad.status, 400);
  const cust = await api('POST', '/api/customers', { token: t, body: { name: 'Rate Wala' } });
  assert.equal(cust.status, 201, cust.text);
  const cid = cust.json.customer.id;
  const rate = await api('POST', `/api/customers/${cid}/prices`, { token: t, body: { product_id: p.json.product.id, price: 75 } });
  assert.equal(rate.status, 201, rate.text);
  assert.equal(rate.json.price.price, 75);
  const list = await api('GET', `/api/customers/${cid}/prices`, { token: t });
  assert.equal(list.status, 200, list.text);
  assert.equal(list.json.prices.length, 1);
  assert.equal(list.json.prices[0].price, 75);
  const del = await api('DELETE', `/api/customers/${cid}/prices/${p.json.product.id}`, { token: t });
  assert.equal(del.status, 200, del.text);
  const list2 = await api('GET', `/api/customers/${cid}/prices`, { token: t });
  assert.equal(list2.json.prices.length, 0);
});

test('12-pack: profit on invoices (detail + list) from buy_price snapshot', async () => {
  const { token: t } = await packSetup();
  const prods = (await api('GET', '/api/products?search=Test%20Biscuit', { token: t })).json.products;
  assert.equal(prods.length, 1, JSON.stringify(prods));
  const pid = prods[0].id;
  const cust = await api('POST', '/api/customers', { token: t, body: { name: 'Profit Wala' } });
  assert.equal(cust.status, 201, cust.text);
  const bill = await api('POST', '/api/invoices', { token: t, body: { customer_id: cust.json.customer.id, items: [{ product_id: pid, qty: 2, sell_price: 100 }], paid_amount: 200, payment_mode: 'Cash' } });
  assert.equal(bill.status, 201, bill.text);
  assert.equal(bill.json.invoice.total, 200);
  const detail = await api('GET', `/api/invoices/${bill.json.invoice.id}`, { token: t });
  assert.equal(detail.status, 200, detail.text);
  // Detail returns profit top-level (with items top-level too — the shape
  // BillDetail reads), while the list carries profit on each invoice.
  assert.equal(detail.json.profit, 80, JSON.stringify(detail.json.invoice));
  assert.equal(detail.json.items[0].profit, 80, JSON.stringify(detail.json.items));
  const list = await api('GET', '/api/invoices', { token: t });
  const mine = list.json.invoices.find((i) => i.id === bill.json.invoice.id);
  assert.equal(mine.profit, 80, JSON.stringify(mine));
});

test('12-pack: partywise P&L + balance sheet agree with the profit bill', async () => {
  const { token: t } = await packSetup();
  const pnl = await api('GET', '/api/reports/party-pnl', { token: t });
  assert.equal(pnl.status, 200, pnl.text);
  const row = pnl.json.customers.find((c) => c.name === 'Profit Wala');
  assert.ok(row, JSON.stringify(pnl.json.customers));
  assert.equal(row.sales, 200);
  assert.equal(row.cost, 120);
  assert.equal(row.profit, 80);
  assert.equal(row.received, 200);
  assert.equal(row.pending, 0);
  const bs = await api('GET', '/api/reports/balance-sheet', { token: t });
  assert.equal(bs.status, 200, bs.text);
  assert.equal(bs.json.stock_value, 480, JSON.stringify(bs.json)); // 8 × ₹60 left
  assert.equal(bs.json.receivables, 0);
  assert.equal(bs.json.assets, 480);
  assert.equal(bs.json.liabilities, 0);
  assert.equal(bs.json.net, 480);
});

test('12-pack: udhaar reminders list shows pending customers', async () => {
  const { token: t } = await packSetup();
  const prods = (await api('GET', '/api/products?search=Test%20Biscuit', { token: t })).json.products;
  const cust = await api('POST', '/api/customers', { token: t, body: { name: 'Reminder Wala', phone: '9822222222' } });
  assert.equal(cust.status, 201, cust.text);
  const bill = await api('POST', '/api/invoices', { token: t, body: { customer_id: cust.json.customer.id, items: [{ product_id: prods[0].id, qty: 1, sell_price: 100 }], paid_amount: 0, payment_mode: 'Cash' } });
  assert.equal(bill.status, 201, bill.text);
  const rem = await api('GET', '/api/customers/reminders', { token: t });
  assert.equal(rem.status, 200, rem.text);
  const mine = rem.json.reminders.find((r) => r.name === 'Reminder Wala');
  assert.ok(mine, JSON.stringify(rem.json.reminders));
  assert.equal(mine.pending, 100);
  assert.equal(mine.bill_count, 1);
  assert.ok(rem.json.reminders.every((r) => r.pending > 0), 'every row has pending > 0');
});

test('12-pack: soft delete + restore for customers and products', async () => {
  const { token: t } = await packSetup();
  const cust = await api('POST', '/api/customers', { token: t, body: { name: 'Restore Wala' } });
  assert.equal(cust.status, 201, cust.text);
  const cid = cust.json.customer.id;
  const del = await api('DELETE', `/api/customers/${cid}`, { token: t });
  assert.equal(del.status, 200, del.text);
  const list = (await api('GET', '/api/customers', { token: t })).json.customers;
  assert.equal(list.find((c) => c.id === cid), undefined);
  const gone = (await api('GET', '/api/customers?deleted_only=1', { token: t })).json.customers;
  assert.ok(gone.find((c) => c.id === cid), 'deleted customer visible with deleted_only=1');
  const res = await api('POST', `/api/customers/${cid}/restore`, { token: t });
  assert.equal(res.status, 200, res.text);
  const back = (await api('GET', '/api/customers', { token: t })).json.customers;
  assert.ok(back.find((c) => c.id === cid), 'restored customer is back in the list');
  // A customer WITH bills still cannot be deleted (old guard unchanged).
  const all = (await api('GET', '/api/customers', { token: t })).json.customers;
  const withBills = all.find((c) => c.name === 'Profit Wala');
  const blocked = await api('DELETE', `/api/customers/${withBills.id}`, { token: t });
  assert.equal(blocked.status, 400);
  assert.equal(blocked.json.error, 'customer_has_invoices');
  // Product soft delete + restore.
  const prod = await api('POST', '/api/products', { token: t, body: { name: 'Restore Item', buy_price: 10, sell_price: 20, stock_qty: 5 } });
  assert.equal(prod.status, 201, prod.text);
  const pid = prod.json.product.id;
  assert.equal((await api('DELETE', `/api/products/${pid}`, { token: t })).status, 200);
  const bp = (await api('GET', '/api/billing-products', { token: t })).json.products;
  assert.equal(bp.find((p) => p.id === pid), undefined);
  assert.equal((await api('POST', `/api/products/${pid}/restore`, { token: t })).status, 200);
  const bp2 = (await api('GET', '/api/billing-products', { token: t })).json.products;
  assert.ok(bp2.find((p) => p.id === pid), 'restored product is billable again');
});

// ---------- Pricing tiers (LOCKED 28 Nov 2026) ----------
test('plan: tier picker validates + stores the tier', async () => {
  const { token: t } = await packSetup(); // trial → full access
  const bad = await api('POST', '/api/subscription/plan', { token: t, body: { plan: 'vip' } });
  assert.equal(bad.status, 400);
  const ok = await api('POST', '/api/subscription/plan', { token: t, body: { plan: 'everything' } });
  assert.equal(ok.status, 200, ok.text);
  assert.equal(ok.json.plan, 'everything');
  const sub = await api('GET', '/api/subscription', { token: t });
  assert.equal(sub.status, 200, sub.text);
  assert.equal(sub.json.plan_tier, 'everything');
  assert.equal(sub.json.plan, 'everything'); // trial = full access
});

test('plan: free tier after trial — udhaar open, billing locked, 25-customer limit', async () => {
  const { token: t, bizId } = await makePackBusiness('gatefree@bizyour.demo', 'Free Owner', '9812345672');
  // Trial-era data: a product + a customer with an unpaid ₹100 bill.
  const prod = await api('POST', '/api/products', { token: t, body: { name: 'Free Biscuit', buy_price: 60, sell_price: 100, stock_qty: 10 } });
  assert.equal(prod.status, 201, prod.text);
  const cust = await api('POST', '/api/customers', { token: t, body: { name: 'Free Udhaar Wala', phone: '9833333333' } });
  assert.equal(cust.status, 201, cust.text);
  const cid = cust.json.customer.id;
  const bill = await api('POST', '/api/invoices', { token: t, body: { customer_id: cid, items: [{ product_id: prod.json.product.id, qty: 1, sell_price: 100 }], paid_amount: 0, payment_mode: 'Cash' } });
  assert.equal(bill.status, 201, bill.text);
  // Pick the free tier, then let the trial end.
  assert.equal((await api('POST', '/api/subscription/plan', { token: t, body: { plan: 'free' } })).status, 200);
  await expireTrial(bizId);
  const sub = await api('GET', '/api/subscription', { token: t });
  assert.equal(sub.json.plan, 'free');
  assert.equal(sub.json.subscription.read_only, true);
  // Billing writes are blocked by the expired-trial lock; udhaar stays open.
  assert.equal((await api('POST', '/api/invoices', { token: t, body: { items: [{ product_id: prod.json.product.id, qty: 1, sell_price: 100 }], paid_amount: 100 } })).json.error, 'subscription_expired');
  assert.equal((await api('POST', '/api/products', { token: t, body: { name: 'Nope', buy_price: 1, sell_price: 2 } })).json.error, 'subscription_expired');
  const c2 = await api('POST', '/api/customers', { token: t, body: { name: 'Free Second' } });
  assert.equal(c2.status, 201, c2.text);
  const vas = await api('POST', `/api/customers/${cid}/vasuli`, { token: t, body: { amount: 100, mode: 'Cash' } });
  assert.equal(vas.status, 201, vas.text);
  // Everything-only reads are plan-gated even for reads.
  assert.equal((await api('GET', '/api/reports/party-pnl', { token: t })).json.error, 'plan_required');
  assert.equal((await api('GET', '/api/customers/reminders', { token: t })).json.error, 'plan_required');
  // A paid tier cannot be picked while expired; free can always be re-picked.
  assert.equal((await api('POST', '/api/subscription/plan', { token: t, body: { plan: 'billing' } })).status, 403);
  assert.equal((await api('POST', '/api/subscription/plan', { token: t, body: { plan: 'free' } })).status, 200);
  // Paid period + free tier: the plan gate itself (not the lock) blocks billing.
  await setPaidPeriod(bizId, 'monthly');
  assert.equal((await api('POST', '/api/invoices', { token: t, body: { items: [{ product_id: prod.json.product.id, qty: 1, sell_price: 100 }], paid_amount: 100 } })).json.error, 'plan_required');
  assert.equal((await api('POST', '/api/products', { token: t, body: { name: 'Nope', buy_price: 1, sell_price: 2 } })).json.error, 'plan_required');
  // Free customer limit: 25 max (2 exist already — fill to 25, 26th is 403).
  for (let i = 0; i < 23; i++) {
    const r = await api('POST', '/api/customers', { token: t, body: { name: `Free Cust ${i}` } });
    assert.equal(r.status, 201, r.text);
  }
  const over = await api('POST', '/api/customers', { token: t, body: { name: 'Twenty Sixth' } });
  assert.equal(over.status, 403);
  assert.equal(over.json.error, 'plan_limit');
});

test('plan: billing tier can bill, everything features stay locked', async () => {
  const { token: t, bizId } = await makePackBusiness('gatebill@bizyour.demo', 'Bill Owner', '9812345673');
  assert.equal((await api('POST', '/api/subscription/plan', { token: t, body: { plan: 'billing' } })).status, 200);
  await setPaidPeriod(bizId, 'monthly');
  const sub = await api('GET', '/api/subscription', { token: t });
  assert.equal(sub.json.plan, 'billing');
  const prod = await api('POST', '/api/products', { token: t, body: { name: 'Bill Biscuit', buy_price: 60, sell_price: 100, stock_qty: 10 } });
  assert.equal(prod.status, 201, prod.text);
  const cust = await api('POST', '/api/customers', { token: t, body: { name: 'Bill Wala' } });
  assert.equal(cust.status, 201, cust.text);
  const bill = await api('POST', '/api/invoices', { token: t, body: { customer_id: cust.json.customer.id, items: [{ product_id: prod.json.product.id, qty: 1, sell_price: 100 }], paid_amount: 100, payment_mode: 'Cash' } });
  assert.equal(bill.status, 201, bill.text);
  // Special rates are Billing; custom fields + P&L + reminders + restore are Everything.
  assert.equal((await api('POST', `/api/customers/${cust.json.customer.id}/prices`, { token: t, body: { product_id: prod.json.product.id, price: 90 } })).status, 201);
  assert.equal((await api('POST', '/api/products', { token: t, body: { name: 'CF Blocked', buy_price: 1, sell_price: 2, custom_fields: [{ key: 'X', value: 'y' }] } })).json.error, 'plan_required');
  assert.equal((await api('GET', '/api/reports/party-pnl', { token: t })).json.error, 'plan_required');
  assert.equal((await api('GET', '/api/reports/balance-sheet', { token: t })).json.error, 'plan_required');
  assert.equal((await api('GET', '/api/customers/reminders', { token: t })).json.error, 'plan_required');
  const delCust = await api('POST', '/api/customers', { token: t, body: { name: 'Bill Delete Me' } });
  assert.equal(delCust.status, 201, delCust.text);
  const del = await api('DELETE', `/api/customers/${delCust.json.customer.id}`, { token: t });
  assert.equal(del.status, 200, del.text); // delete works on Billing…
  assert.equal((await api('POST', `/api/customers/${delCust.json.customer.id}/restore`, { token: t })).json.error, 'plan_required'); // …restore needs Everything
});

test('plan: everything tier unlocks all 12-pack features', async () => {
  const { token: t, bizId } = await makePackBusiness('gateall@bizyour.demo', 'All Owner', '9812345674');
  assert.equal((await api('POST', '/api/subscription/plan', { token: t, body: { plan: 'everything' } })).status, 200);
  await setPaidPeriod(bizId, 'yearly');
  const sub = await api('GET', '/api/subscription', { token: t });
  assert.equal(sub.json.plan, 'everything');
  assert.equal((await api('GET', '/api/reports/party-pnl', { token: t })).status, 200);
  assert.equal((await api('GET', '/api/reports/balance-sheet', { token: t })).status, 200);
  assert.equal((await api('GET', '/api/customers/reminders', { token: t })).status, 200);
  const prod = await api('POST', '/api/products', { token: t, body: { name: 'CF Allowed', buy_price: 1, sell_price: 2, stock_qty: 5, custom_fields: [{ key: 'X', value: 'y' }] } });
  assert.equal(prod.status, 201, prod.text);
  assert.deepEqual(prod.json.product.custom_fields, [{ key: 'X', value: 'y' }]);
  const cust = await api('POST', '/api/customers', { token: t, body: { name: 'All Wala' } });
  assert.equal(cust.status, 201, cust.text);
  assert.equal((await api('DELETE', `/api/customers/${cust.json.customer.id}`, { token: t })).status, 200);
  assert.equal((await api('POST', `/api/customers/${cust.json.customer.id}/restore`, { token: t })).status, 200);
});

test('plan: free khata budget — 100th udhaar entry allowed, 101st blocked', async () => {
  const { token: t, bizId } = await makePackBusiness('gatetxn@bizyour.demo', 'Txn Owner', '9812345675');
  const cust = await api('POST', '/api/customers', { token: t, body: { name: 'Txn Wala', phone: '9844444444' } });
  assert.equal(cust.status, 201, cust.text);
  const cid = cust.json.customer.id;
  assert.equal((await api('POST', '/api/subscription/plan', { token: t, body: { plan: 'free' } })).status, 200);
  await expireTrial(bizId);
  // 100 manual udhaar entries (kind='opening' invoices) — the 100th is
  // still allowed; the 101st is blocked with plan_limit.
  for (let i = 0; i < 100; i++) {
    const r = await api('POST', `/api/customers/${cid}/khata`, { token: t, body: { amount: 10 } });
    assert.equal(r.status, 201, `entry ${i + 1}: ${r.text}`);
  }
  const over = await api('POST', `/api/customers/${cid}/khata`, { token: t, body: { amount: 10 } });
  assert.equal(over.status, 403);
  assert.equal(over.json.error, 'plan_limit');
  // A payment received is a khata entry too — also blocked at the limit.
  assert.equal((await api('POST', `/api/customers/${cid}/vasuli`, { token: t, body: { amount: 10, mode: 'Cash' } })).json.error, 'plan_limit');
  // The usage meter reports the limit.
  const usage = await api('GET', '/api/customers/khata-usage', { token: t });
  assert.equal(usage.status, 200, usage.text);
  assert.equal(usage.json.used, 100);
  assert.equal(usage.json.limit, 100);
  assert.equal(usage.json.remaining, 0);
  // Khata entries are udhaar, not sales: pending shows ₹1,000.
  const detail = await api('GET', `/api/customers/${cid}`, { token: t });
  assert.equal(detail.json.customer.pending, 1000);
});

test('plan: paid plans have unlimited khata entries', async () => {
  const { token: t } = await packSetup(); // trial → unlimited
  const cust = await api('POST', '/api/customers', { token: t, body: { name: 'Unlimited Wala' } });
  assert.equal(cust.status, 201, cust.text);
  for (let i = 0; i < 3; i++) {
    const r = await api('POST', `/api/customers/${cust.json.customer.id}/khata`, { token: t, body: { amount: 50 } });
    assert.equal(r.status, 201, r.text);
  }
  const usage = await api('GET', '/api/customers/khata-usage', { token: t });
  assert.equal(usage.status, 200, usage.text);
  assert.equal(usage.json.limit, null); // unlimited on trial/paid
  assert.ok(usage.json.used >= 3, JSON.stringify(usage.json));
  const bad = await api('POST', `/api/customers/${cust.json.customer.id}/khata`, { token: t, body: { amount: 0 } });
  assert.equal(bad.status, 400);
});
