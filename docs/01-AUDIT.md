# 01 — Product audit (as received, 22 Nov 2026)

Source: `Bizyour-main.zip`. Baseline committed as the first git commit in this repo.

## Shape of the code

| Part | File | Lines | Notes |
|---|---|---|---|
| API server | `backend/server.js` | 6,061 | Every Workspace route, auth, admin, sync, import, reports in one file |
| Mart API | `backend/mart.js` | 1,144 | Already a separate module (`registerMart(app)`) |
| Data layer | `backend/db.js` | 1,064 | SQLite (`node:sqlite`) ↔ Postgres translator, schema, migrations |
| Frontend | `frontend/app.js` · `index.html` · `mart.js` | 4,377 · 1,749 · 1,014 | Vanilla JS, screens are `<section>`s toggled by `showScreen()`, HTML built as strings (~170 `innerHTML`) |
| i18n | `frontend/i18n-hg.js` + `data-en/data-hi` attributes | 853 | English / हिंदी / Hinglish |
| PWA | `sw.js`, `manifest.webmanifest` | — | Service worker caches app shell (including `config.js`) |

Live split deploy: `frontend/config.js` points at `https://bizyour-i08s.onrender.com/`.

## Roles and access (must be preserved)

| Guard | Who passes |
|---|---|
| `requireAuth` | Any logged-in user (business user or super admin) |
| `requireOwner` | `role = owner` |
| `requireStockAccess` | owner, or staff with access `all` / `stock` |
| `requireBillingAccess` | owner, or staff with access `all` / `billing` |
| `requireSuperAdmin` | DILIGENCE platform admin (separate table and sessions) |
| `subscriptionGuard` | Expired subscription → every write returns `403 subscription_expired` (reads, sync and restore exempt) |

Finance (expenses, reports, profit, dashboard-finance, exports of sales/expenses/purchases, audit, backups) is owner-only **on the server**.

## Feature inventory (Workspace)

| Area | Capabilities | Key endpoints |
|---|---|---|
| Auth | Email/mobile login, signup with email OTP, resend, forgot/reset password, logout, add mobile | `/api/auth/*`, `/api/me` |
| Onboarding | 8-step checklist computed from real data, dismiss, WhatsApp step | `/api/onboarding*` |
| Business settings | Name, owner, phone, city, GST on/off, GSTIN, UPI ID + payee, payment QR image, language | `GET/PUT /api/business` |
| Staff | List, add (access all/billing/stock), remove | `/api/staff` |
| Subscription | Trial→active→grace→read-only, plans, UPI/manual claim, Razorpay-ready order/verify, printable invoice | `/api/subscription*` |
| Products | CRUD, category, unit, buy/sell price, GST %, HSN, opening stock, low-stock limit, status ok/low/out | `/api/products`, `/api/low-stock` |
| Suppliers | CRUD with total purchased / paid / pending | `/api/suppliers` |
| Purchases | Multi-item purchase (stock in), paid now + mode, due date, later payments | `/api/purchases*` |
| Customers | CRUD, GSTIN, totals, pending (udhaar), detail with bills + payments | `/api/customers*` |
| Hisab link | Public read-only customer statement page by token; create / regenerate / disable | `/api/customers/:id/hisab-link*`, `/hisab/:token` |
| Billing | Multi-item bill, Walk-in or customer, GST-inclusive math, discount, paid now + mode (Cash/UPI/Bank/Udhaar), due date (default +15 days), insufficient-stock block, UPI QR of balance | `POST /api/invoices`, `/api/billing-products`, `/api/billing/recent-items` |
| Bills | List, detail, edit, cancel with reason, record payment, due date, WhatsApp link, e-way bill JSON, e-invoice JSON | `/api/invoices/*` |
| Estimates | Create, list, detail, WhatsApp link, convert to bill | `/api/estimates*` |
| Returns | Return against a bill, list, detail, WhatsApp link | `/api/invoices/:id/returns`, `/api/returns*` |
| Collections | Vasuli (lump-sum payment allocated across a customer's bills), reminder WhatsApp link | `/api/customers/:id/vasuli`, `/reminder-link` |
| Alerts | Customer dues (overdue/today/soon), supplier dues, low stock | `/api/alerts` |
| Expenses | CRUD, 8 categories, payment mode | `/api/expenses` (owner) |
| Reports | Summary by period, daily sales, expense categories, pending lists, GST (CGST/SGST, by rate, input GST, net payable), GSTR-1 JSON + download, monthly with 6-month trend, report card, day-end summary + WhatsApp links | `/api/reports/*` (owner) |
| Dashboard | Today's sale/bills, pending collection, recent bills; finance (expense, COGS, gross, net) owner-only | `/api/dashboard-summary`, `/api/dashboard-finance` |
| Search | Products, customers, suppliers, bills — role-filtered | `/api/search` |
| History | Audit log, paged | `/api/audit` |
| Backup | DB file / JSON download, daily snapshots (keep 7), backup now, download, one-click restore with pre-restore snapshot | `/api/backup`, `/api/backups*` |
| Export | CSV for products, customers, suppliers, sales, expenses, purchases | `/api/export/*` |
| Import | CSV/TSV/XLSX preview + commit (products, customers, suppliers, opening balances; Vyapar-style) | `/api/import/:type/*` |
| Sync | Local ↔ cloud hub push/pull, status, conflicts, Sync now | `/api/sync/*` |
| Help | Support WhatsApp, link, video (admin-set) | `/api/help` |
| Super admin | Businesses list/detail, extend, block, delete, plan, users, payments approve/reject, plan prices, settings, summary | `/api/admin/*` |

## Feature inventory (Business Mart)

Profile (sell on/off, categories, delivery cities, about) · restock suggestions from low stock · match preview · inquiries (single + bulk, anonymous, GST-only) · leads (matched + all) · quotes (send, edit, withdraw, decline, accept) · quote chat + counter-offers · quotes sent · orders (confirm, dispatch, cancel, mark received → Workspace purchase + stock, rate) · listings / catalog with photo · seller directory + profiles · favourites · notifications · Mart report. All under `/api/mart/*`.

## Calculations that must not change

- Prices are **GST-inclusive**. GST part = `amount × rate / (100 + rate)`, rate snapshot per line, only when business GST is ON.
- Bill total = subtotal − discount. Paid ≤ total. Status paid / partial / pending.
- Net profit = Sale − COGS (buy price snapshot) − Expenses. Purchases are stock, not expense.
- Stock changes only through `stock_movements` (purchase, sale, return, Mart receipt).
- Demo canonical numbers: today's sale ₹1,128 · to collect ₹1,620 · to pay ₹2,300 · stock value ₹22,051 · today's net +₹30.

## UX problems found

1. **The dashboard is a long stack of full-width cards.** Alerts, day-end, onboarding, then KPIs below the fold. It doesn't answer "how am I doing" at a glance.
2. **The navigation is a flat list of 13 items** organised by database table (Products, Purchases, Suppliers, New Bill, Estimates…). "WhatsApp" links to the billing screen, so it's a duplicate entry.
3. **Billing is a form, not a counter.** There's no type-to-add search as the primary action. Items are added one row at a time behind "+ Add item", and there are no keyboard shortcuts.
4. **There are no detail views for products or suppliers.** Editing happens in modals, and customer history sits at the bottom of a long page.
5. **The two pillars feel stitched together.** Mart is a toggle inside the sidebar, and its badge count is the only connection.
6. **Mobile is the desktop layout squeezed.** The top bar wraps into three rows, and there's no bottom navigation or one-thumb billing.
7. **The visual language is inconsistent.** Emoji serve as icons, the font stack switches between screens, density varies, and blue is used for everything.

## Technical problems found

See the security list in the first analysis: no rate limiting on login/OTP, sessions never expire, vulnerable `xlsx`, no security headers, CORS open by default, a race on quote accept, synchronous bcrypt, and a 6-character password minimum. On top of that: a 6,000-line server file, frontend HTML built from strings, no automated tests, and the service worker caches `config.js` (an API base change can be masked by a stale cache).
