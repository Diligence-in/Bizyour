# 05 — Validation report (22 Nov 2026)

Everything below was actually run in this session. Nothing is marked tested that wasn't.

## Automated

| Suite | How to run | Result |
|---|---|---|
| API regression (11 tests) | `cd backend && npm test` | **11/11 pass**: expired Workspace trial is read-only while Business Mart writes still work, canonical demo numbers, security headers, login rate limit, 8-char passwords, session expiry, cross-business isolation (read/update/delete/search), billing-only staff 403s, GST-inclusive bill maths and stock movement, insufficient-stock block, concurrent quote accept → exactly one order, CSV export, XLSX import via exceljs |
| Browser flows, Workspace (13) | `npm run test:e2e` (fresh seeded DB, real Chrome, results checked through the API) | **13/13 pass**, 0 console errors |
| Browser flows, Business Mart (11) | same runner: two browsers, a buying shop and a wholesaler | **11/11 pass**, 0 console errors |
| Browser flows, visitor journey, signup and password reset (7) | same runner; codes read from the server's `[DEV-MAIL]` log lines | **7/7 pass**, 0 console errors: logo intro → home page (plays once per visit) → Create free account → code → setup → Workspace \| Business Mart doors (Mart "Free, always", Workspace "Trial · 30 days left") → Mart mode hides Workspace menu and vice versa → switch remembers the last screen; phone home page, doors and Mart bottom bar; reset; unconfirmed login |
| Same suites on **PostgreSQL** (cloud mode, as on Neon) | `TEST_DATABASE_URL=postgres://… npm test` (empty DB); E2E with `DATABASE_URL` set | **11/11 API** (re-run 22 Nov with the Mart-free test), 13/13 Workspace, 11/11 Mart pass on PostgreSQL 17 |
| Upgrade on an existing database | Old (original zip) code creates and uses a Postgres DB, then v4 boots on it | Same 42 tables before and after (no schema change); old login sessions still work; bills made by the old code are counted |
| Signup / reset email (Brevo-style SMTP with login) | Local SMTP server requiring username + SMTP key; real `/api/auth/signup` → email → `/verify-otp` | OTP email delivered with the right From/Subject, the code from the email verified the account, reset email delivered |
| Type check + build | `cd web && npm run build` | Clean |
| Dependency audit | `npm audit --omit=dev` (backend) | **0 vulnerabilities** (was 2 high) |

Mart flows covered: restock request from low stock (checks product link, source, qty, category, sellers told) · matched seller quotes · buyer counter-offer (checks message kind and amount) · seller opens the notification → chat and updates the price · accept (checks order total 24 × ₹102 = ₹2,448) · seller confirms and dispatches with a transporter · buyer marks received with ₹1,000 paid (checks Surf Excel stock +24, purchase BM-… total ₹2,448 / paid ₹1,000) and rates 5★ · catalog item with photo (checks stored JPEG) · browse → seller page → favourite · request to two picked sellers → one merged comparison · billing-only staff can't open Mart.

Workspace flows covered: login form · keyboard-only udhaar bill (N → type → Enter → C → F5 → Ctrl+Enter; checks udhaar +₹575, stock −1, due date set) · tap-only cash bill with discount (checks total ₹200, UPI, discount 3) · part payment on a bill · item return (₹45 back) · vasuli from the customer page (balance → ₹0) · hisab link opens the public page · add product → shows at the counter · purchase raises stock (+10) and supplier payable (+₹100) · cancel bill restores stock · ⌘K finds a customer and opens them · billing-only staff can't see profit or products (and a direct URL redirects home) · Hindi switch.

## Manual / visual

| Check | Result |
|---|---|
| Desktop 1440×900: all 9 rebuilt screens + login | Screenshots reviewed (`docs/screenshots/after-desktop-*`) |
| Mobile 390×844: all rebuilt screens, full tap billing flow, "More" sheet | Screenshots reviewed (`after-mobile-*`); bottom bar, centre ＋, bottom-sheet payment |
| Classic bridge: Reports and Mart open from the new nav with the same login; "Back to the new BizYour" returns | Pass |
| Print view of a bill | Print CSS hides chrome; invoice only (browser print preview not captured headlessly) |
| Tablet (768–1100 px) | Layout rules exist (sidebar stays, POS side panel narrows to 340 px). **Not screenshotted this session.** |

## Bug found and fixed in the original code

- **The public hisab page (`/hisab/:token`) crashed for every customer.** Its Hinglish string table referred to `T.noBills` before `T` existed, which threw on load and left a blank page. This was in the original zip, not caused by this work. Fixed in `server.js`, and the E2E flow "share a hisab link" now opens the page and checks the customer name.

## Feature preservation checklist

✅ rebuilt in the new app · ↗ opens the classic screen (same login, deep link) · nothing ❌

| Capability | Where now |
|---|---|
| Login | ✅ |
| Signup with email OTP (resend with 60 s wait, wrong-code tries left), shop setup (name, owner, phone, city, GST/GSTIN, language), forgot → code → new password → logged in, unconfirmed account sent to the code screen | ✅ |
| Public landing page (marketing) | ↗ `/classic/` |
| Dashboard: today's sale, collections, profit, to-collect, alerts, low stock, recent bills, 7-day chart, onboarding next step | ✅ Home |
| Day-end report WhatsApp, report card | ↗ Reports |
| New bill: items, qty, rate edit, discount, GST-inclusive, Walk-in/customer, quick-add customer, Cash/UPI/Bank/Udhaar, part payment, due date (+15 default), insufficient-stock guard | ✅ Counter |
| Bill list, detail, print/PDF, WhatsApp, record payment, cancel with reason, returns, UPI QR, e-way JSON, e-invoice JSON, CGST/SGST on print | ✅ |
| Edit an existing bill | ↗ (button on bill page) |
| Estimates (create, convert, WhatsApp) | ↗ |
| Customers: list, add, edit, totals, pending, bills | ✅ |
| Vasuli (lump-sum allocation), WhatsApp reminder, hisab link create/regenerate/turn off | ✅ |
| Products: list, filters, add, edit, delete, margin, GST/HSN, low-stock limit, export | ✅ |
| Products import (CSV/XLSX) | ↗ Settings |
| Purchases: list, detail, record (new supplier inline), paid now + mode, due date, supplier payment, export | ✅ |
| Suppliers: list, add, edit, payable, export | ✅ |
| Expenses | ↗ |
| Reports: summary, daily sales, categories, pending, GST, GSTR-1 JSON, monthly | ↗ |
| History (audit log) | ↗ |
| Settings: business, GST, UPI/QR, language, staff, subscription & claims, backups/restore, sync, import | ↗ |
| Help | ↗ |
| Mart: restock from low stock (prefilled request) | ✅ Mart home |
| Mart: post request (open / to one seller / to picked sellers = bulk), hide name, GST-only, live "N sellers will be told" | ✅ |
| Mart: my requests, side-by-side quote comparison (best value / lowest / fastest, vs target, MOQ guard, validity), close, share on WhatsApp | ✅ |
| Mart: chat + counter-offer (buyer), price update (seller) | ✅ |
| Mart: accept → order; orders for both sides; confirm, dispatch (date + transporter), cancel, mark received (→ purchase + stock + supplier payment), rate, order again, WhatsApp | ✅ |
| Mart: margin report | ✅ (Orders → Margins) |
| Mart: seller leads (matched / all, "asked you"), quote composer with advance % and credit days, quotes sent, withdraw | ✅ |
| Mart: catalog with photo, show/hide, delete; seller profile (categories, delivery cities, all India) | ✅ |
| Mart: browse products and sellers by category, seller page with reviews, favourites ("my wholesalers") | ✅ |
| Mart: notifications inbox (each opens the right screen), read all, live badges in nav | ✅ |
| Super-admin panel | ↗ (admins are sent to `/classic/` on login) |
| Language EN / हिंदी / Hinglish | ✅ (shared with classic) |
| Global search | ✅ ⌘K palette (same role-filtered `/api/search`) |

## Performance

- First load (login/home): **84 KB gzipped JS + 15 KB CSS**, plus fonts only for the scripts in use (unicode-range subsets).
- Each other screen loads on demand: 2–7 KB gzipped (the counter is 6.7 KB).
- Hashed assets are cached for a year as immutable. HTML is always revalidated.
- The counter's item search filters the in-memory product list (no request per keystroke).
- Not measured: real-device timings on low-end Android or a 3G network.

## Security assessment (after this session)

Fixed: brute-force exposure, never-expiring sessions, vulnerable xlsx/nodemailer, missing headers/CSP, Mart double-order race, synchronous bcrypt, weak password minimum.

Still open (honest):
1. `ALLOWED_ORIGINS` must be **set on Render** by you. Until then any site can call the API from a browser (a warning is logged).
2. Rate-limit counters live in memory. They reset on restart and won't work across several instances.
3. Tokens are still kept in `localStorage`, shared with the classic app. Moving to httpOnly cookies needs CSRF work and a classic-app change.
4. The classic app (`/classic/`) has no CSP, because it uses inline handlers. Its HTML-string rendering remains until each screen is rebuilt.
5. Login timing differs slightly between unknown and known emails (bcrypt only runs for known users).

## Known issues / limitations

- Mart notifications are in-app only (badges refresh every 30 s; chat every 8 s while open). There's no push, SMS or WhatsApp auto-alert, same as before.
- Mart payments still happen outside the app; BizYour records them. "Verified details" means a correctly formatted GSTIN, phone and city are on file. It isn't checked with the GST portal, and the badge tooltip says so.
- The classic Mart (bulk inquiry screen, Mart report) still exists at `/classic/` but is no longer linked from the new app. Everything it did is in the new Mart.

- Screens marked ↗ are not yet redesigned. They work, but look like the old app.
- There's no barcode field on products, so the counter is *scanner-compatible* only by exact name (a scanner types and presses Enter). True barcode billing needs a `barcode` column, which would be a schema change and wasn't done.
- On mobile the counter has no camera scanning.
- Real Brevo wasn't contacted (no keys here). The SMTP test didn't use STARTTLS; nodemailer does that automatically on port 587 with Brevo's valid certificate.
