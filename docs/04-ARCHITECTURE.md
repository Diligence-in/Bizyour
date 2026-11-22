# 04 — Architecture (v4)

```
bizyour/
├── backend/            Express API + data layer (unchanged contract)
│   ├── server.js       Workspace routes, auth, admin, sync, import, static serving
│   ├── mart.js         Business Mart routes (/api/mart/*)
│   ├── db.js           SQLite (local) ↔ Postgres (cloud) layer, schema
│   ├── security.js     NEW: rate limiting, security headers, CSP, session TTL
│   └── test/api.test.js NEW: API regression suite (node:test)
├── web/                NEW: rebuilt app — React 18 + TypeScript + Vite
│   ├── src/lib/        api client, session/permissions, i18n, formatting, types
│   ├── src/components/ ui kit (Button, Field, Drawer, Modal, Table…), shell, ⌘K palette
│   ├── src/pages/      Home, Pos, Bills, BillDetail, Customers, CustomerDetail,
│   │                   Products, Purchases, Suppliers, Login
│   ├── src/styles/     tokens.css → base → components → layout → pages
│   ├── e2e/            Playwright browser flows + fresh-DB runner
│   └── dist/           built app (committed so local mode works offline)
├── frontend/           classic app, now served at /classic/ (kept whole)
└── docs/               audit, research, strategy, architecture, validation, progress
```

## Decisions and why

| Decision | Why | Alternative rejected |
|---|---|---|
| **Keep the Express API and its contract** | It already has correct, tested business maths, tenant isolation and dual-engine storage. Rewriting it would risk data and buy nothing for users. The new app calls the exact same endpoints. | A backend rewrite (NestJS etc.): high risk, no user value this session |
| **React + TypeScript + Vite for the frontend** | The old UI built every screen from HTML strings (~170 `innerHTML`), which is where XSS creeps in and where changes break things. React escapes by default, and TS catches API-shape mistakes at build time. Vite builds in ~2.5 s. | Restructured vanilla JS: still string HTML, no type safety |
| **TanStack Query for server state** | Lists refresh after every mutation through query invalidation (save bill → dashboard, customers and stock update). It caches between screens and refetches on focus. No hand-written global store. | Redux/Zustand: server state isn't client state |
| **No UI library; own small kit** | Full control of the visual language, a tiny bundle, and no fight with someone else's design system. | MUI/Chakra: generic look, heavy |
| **Fonts and icons bundled** (`@fontsource`, `lucide-react`) | Local mode promises zero outbound calls. Everything ships inside `dist/`. | Google Fonts CDN: breaks offline, leaks |
| **Classic app kept at `/classic/`, deep-linked** | Nothing is removed while modules are rebuilt one by one. Same login token (`bos_token`) and language (`bos_lang`). The new nav marks classic screens with ↗. | A big-bang rewrite of all ~40 screens in one session: untestable |
| **Route-level code splitting** | Login and Home load first (84 KB gzipped JS). The counter and lists load on demand. | One bundle |
| **Committed `web/dist`** | The double-click start scripts must work offline with no build step, matching the README promise. Render rebuilds on deploy anyway. | Requiring `npm run build` for shop installs |

## Request flow

```
Browser ──/──────────────▶ Express ── web/dist/index.html (CSP header)
        ──/assets/*──────▶          ── hashed, immutable cache
        ──/classic/*─────▶          ── frontend/ (classic, own SW scope)
        ──/hisab/:token──▶          ── public statement page
        ──/api/*─────────▶ security headers → CORS → subscriptionGuard →
                           requireAuth (session TTL) → role guard → route → db.js
```

## Permissions (mirrored in UI, enforced on server)

`web/src/lib/session.tsx` exposes `can.{owner, finance, billing, stock, mart}` computed with exactly the server's rules. Routes are wrapped in `<Guard perm=…>`, and nav items carry a `perm`. The server still returns 403 for anything the UI might miss. The E2E suite checks that billing-only staff can't see profit or products.

## Security changes (backend)

- Login: 30 attempts per IP per 10 min, plus 10 per account per 15 min. OTP verify/reset: 10 per email per 15 min. Mail-sending routes: 15 per IP per hour. Public hisab: 120 per IP per 5 min. All return `429` with `Retry-After`. The counters are in-memory, which is correct for one process. **If you ever run more than one instance, move the counters to the database or Redis.**
- Sessions expire after `SESSION_TTL_DAYS` (default 30). They're refused on use and swept hourly.
- Headers: `nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`, `Permissions-Policy`, HSTS on HTTPS, and a strict CSP on the new app. `x-powered-by` is off and `trust proxy` is set to 1.
- bcrypt is async in every request path. New passwords need 8+ characters; existing passwords still work.
- The Mart quote accept now does a conditional update inside the transaction, so a double accept can't create two orders.
- `xlsx@0.18.5` (2 high advisories, no fix) was replaced by `exceljs`. `nodemailer` went from 6.10 to 10.6 (many advisories). `mailer.js` only uses `createTransport` + `sendMail`, which work the same in both versions; signup and reset OTP emails were tested through an SMTP server that requires a login, like Brevo's, and `uuid` is pinned via overrides. `npm audit` now reports 0 vulnerabilities.
- A boot warning is logged when `NODE_ENV=production` and `ALLOWED_ORIGINS` is unset. `render.yaml` now lists `ALLOWED_ORIGINS`.

## Database

**No schema change.** No new table, no ALTER, no migration. The only data-layer change is an optional `BOS_DATA_DIR` env var (default unchanged) so tests can use a throwaway database. Existing local SQLite files and the Neon Postgres database work as-is. Rollback = deploy the previous commit.

## API compatibility

All 180 existing endpoints are unchanged in path, body and response. Additions:

- `/classic/*` (static), `/classic/config.js` (always same-origin when served by the backend), and `/sw.js` (self-unregistering, only when `web/dist` exists).
- Error code `too_many_requests` (429), plus `session_expired` (401) and `password_too_short` (400) on the 8-character rule.
