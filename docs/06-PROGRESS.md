# 06 — Progress record (pick up here next session)

## Done (session 1, 22 Nov 2026)

- [x] Audit, feature inventory → `01-AUDIT.md`
- [x] Competitor research, matrix, positioning → `02-RESEARCH.md`
- [x] IA, journeys, design direction, tokens → `03-STRATEGY-AND-DESIGN.md`
- [x] Backend hardening + API test suite (10 tests)
- [x] New web app foundation: tokens, UI kit, shell (sidebar / bottom bar / More sheet), ⌘K palette, i18n, session + permissions, classic bridge
- [x] Rebuilt: Login, Home, Counter (POS), Bills, Bill detail (print, pay, return, cancel, e-way/e-invoice JSON), Customers, Customer khata (vasuli, reminder, hisab link), Products, Purchases, Suppliers
- [x] E2E browser suite (13 flows), screenshots before/after
- [x] Fixed the original hisab page crash

## Done (session 2, 22 Nov 2026)

- [x] **Business Mart rebuilt in the new app**: buyer (restock, requests incl. picked-seller bulk, side-by-side compare, chat/counter, accept, orders, receive → purchase + stock, rate, order again, margins), seller (leads, quote composer, quotes sent, orders confirm/dispatch, catalog with photos, profile), browse + seller pages + favourites, notifications. 11 two-browser E2E flows.

## Done (session 3)

- [x] Signup → email code → shop setup, and forgot → code → new password, in the new app (same auth API, same SMTP/Brevo settings). 5 browser flows.

## Done (session 4)

- [x] **Business Mart is free forever; the 30-day trial and plans cover Workspace only.** Server: `/api/mart/*` skips the subscription lock (API test proves an expired Workspace still posts to Mart and is blocked for Workspace writes). Copy: signup, setup, sidebar note, read-only note and error text all say "Workspace trial".
- [x] **Public home page** at `/` for visitors (Ledger design, real screenshots, two-sides section, Workspace features, Mart 4-step loop, a day with BizYour, who it's for, pricing without invented prices, FAQ, IITians/DILIGENCE, footer) with a **logo intro** once per visit (skippable, off under reduced motion). Login moved to `/login`; logging out lands there.
- [x] **Workspace | Business Mart**: side-by-side doors after signup and each fresh login (skipped for one-sided staff), and a persistent switch at the top of the sidebar / phone screen. The side is read from the URL; each side has its own menu and phone bottom bar; the switch returns you to the last screen on that side.

## Next, in order

1. **Money**: Expenses (list, add, categories); Reports (period picker, P&L ledger, GST with CGST/SGST by rate, GSTR-1 download, monthly trend, day-end + WhatsApp, report card).
2. **Settings hub**: business & GST, UPI + QR upload, staff, subscription/claims/invoice, backups + restore, sync status/conflicts, import wizard, language, help.
3. **Estimates** and **edit bill** inside the new app.
4. Remove `/classic/` once every ↗ item is rebuilt (keep the `/classic/` URL redirecting for a release).
5. Hardening follow-ups: Postgres E2E run, httpOnly-cookie sessions, DB-backed rate limits, a `barcode` column (with migration and rollback) for real barcode billing.

## How to continue

```
npm run setup            # installs backend + web
npm run build            # builds web/dist
npm start                # http://localhost:4000 (new app) and /classic/
npm test                 # API suite
npm run test:e2e         # browser flows on a fresh demo DB
cd web && npm run dev    # hot-reload UI on :5173 (proxies the API on :4000)
```

When a classic screen is rebuilt, change its entry in `web/src/components/shell/nav.tsx` from `to: '/classic/#go=…', classic: true` to an in-app route, then add an E2E flow.

## 22 Nov — every menu item now lives in the new app
Estimates, Expenses, Reports & GST (overview, month by month, GST, GSTR-1), History, Settings (shop, staff, plan, data/backup/import) and Help were rebuilt in the new app; nothing in the menu opens the old screens any more. The logo now shows in the very first HTML (before JavaScript) and logo files are revalidated, so an old cached logo cannot linger. E2E: 41 flows (screens_flows.py added), API: 12 tests. Not rebuilt: the old sync-status and conflicts panels, and online (Razorpay) payment — UPI claim still works.

## 22 Nov — blue theme
Colour theme returned to the original blue (#2563EB accent, navy ink, cool paper). Business Mart keeps its amber, money keeps green/red. Landing screenshots retaken in blue. Fixed a `.pos` class clash (money-positive colour vs the billing screen container). The palette E2E now waits for the search box before typing.

## Export as Excel and PDF
- Every Export/Download button is now a menu: Excel (.xlsx), PDF or CSV (`web/src/components/ExportMenu.tsx`). GST register also offers the portal JSON.
- Server: `?format=csv|xlsx|pdf` on all `/api/export/*` and `/api/reports/gstr1/download` (`backend/exporter.js`, exceljs + pdfkit, Plex fonts incl. Devanagari in `backend/fonts/`).
- Backups and e-way/e-invoice stay JSON (machine formats).
