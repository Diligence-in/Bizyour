# 02 — Competitor research and positioning

Researched 22 Nov 2026 from public product pages, help centres, app-store listings and review sites. Every capability below links to the page where it was checked. Anything I couldn't verify is marked "not verified" rather than assumed.

## A. Retail billing, inventory and accounting

| Product | What it does especially well (verified) | Pattern for BizYour |
|---|---|---|
| **Vyapar** | Sells billing speed: "Make a POS bill in 30 seconds" ([vyaparapp.in](https://vyaparapp.in/z/pos-billing-testing)). Counter billing with barcode scanning and shortcut keys ([llms.txt](https://vyaparapp.in/llms.txt)). The dedicated POS screen is desktop-only and needs an external scanner ([guide](https://vyaparapp.in/guides/how-to-do-pos-billing-with-vyapar)). A G2 reviewer complains items can't be picked by code from the keyboard ([G2](https://www.g2.com/products/vyapar)). | Billing has to be keyboard-complete *and* work on a phone. That fills two gaps Vyapar leaves. |
| **myBillBook** | Claims an invoice in under 15 seconds ([App Store](https://apps.apple.com/us/app/id1612498254)). The flow is "+ Bill" from the dashboard → select party → add items ([mybillbook.in](https://mybillbook.in/free/)). Positions one sale as updating invoice, payment, stock, customer balance and reports with no re-entry ([blog](https://mybillbook.in/blog/?p=10849)). | The same "one entry, everything updates" promise. BizYour already does this; the UI should *show* it happening (stock left, balance after). |
| **TallyPrime** | Keyboard-first by design: every voucher, report and navigation has a shortcut. Alt+G "Go To" is command-based navigation; F8 Sales, F9 Purchase ([Tally](https://tallysolutions.com/business-guides/tallyprime-keyboard-first-design-fast-data-entry/)). | Global ⌘K / Ctrl+K "Go to / do" palette, plus single-key shortcuts for the hot paths (N new bill, P payment). Experienced traders already know this mental model from Tally. |
| **Khatabook** | Built around udhaar: payment reminders and UPI payment links are what reviewers value most ([G2](https://www.g2.com/products/khatabook/reviews)). Set a collection date and an automatic SMS reminder goes out the day before ([blog](https://khatabook.com/blog/use-khatabook-for-faster-returns)). | Collections deserve a first-class place, not a column in Customers. BizYour already has due dates, WhatsApp reminders, a public hisab link and vasuli; they need one home. |
| **Zoho Inventory** | The dashboard shows "pending actions" and top-selling items ([help](https://www.zoho.com/inventory/help/getting-started/dashboard.md)). A Replenishments list collects items below their reorder point so purchase orders can be raised in bulk ([help](https://www.zoho.com/inventory/help/items/replenishments.html)). | "Needs attention" as a dashboard pattern. BizYour's low-stock → Mart inquiry ("Restock") is the stronger version: it reaches *new* suppliers, not just a PO to the old one. |
| **BUSY / Marg** | Desktop ERP depth: e-way bills generated alongside invoices, e-invoice with IRN/QR, HSN validation ([busy.in](https://busy.in/busy-vs-marg/)). Marg is strongest in pharma (per BUSY's own comparison). | Out of scope to match feature-for-feature. BizYour exports e-way and e-invoice JSON; keep that, and surface missing HSN codes as a fixable warning. |
| **GoFrugal** | Offline billing with sync, multi-mode payments, cashier sessions, mobile POS (GoBill) ([gofrugal.com](https://gofrugal.com/retail)). | BizYour's local mode + sync covers offline. Cashier sessions and shift handover are a future idea, not built. |

## B. B2B marketplaces

| Product | Verified pattern | Lesson |
|---|---|---|
| **IndiaMART** | A buyer posts a requirement, IndiaMART filters it and shares it with relevant sellers ("BuyLead") ([help](https://help.indiamart.com/knowledge-base/buy-lead-vs-enquiry)). Sellers pay per lead consumed. Sellers manage leads, shortlists and replies in a Lead Manager ([help](https://help.indiamart.com/video-homepage)). | BizYour's matching is the same idea, but **free and tied to stock data**. The seller side needs a proper lead inbox with status, like IndiaMART's Lead Manager. |
| **Alibaba** | RFQ: post one specification, suppliers come to you, quotes land on a comparison page ([reads.alibaba.com](https://reads.alibaba.com/?p=114372)). Trust comes from "Verified supplier" / "Trade Assurance" badges and filters ([seller blog](https://seller.alibaba.com/businessblogs/px65f6s8-how-to-buy-and-source-from-alibaba)). | Quote comparison should be a real side-by-side table. Trust badges must be honest: BizYour's "GST" badge only means a GSTIN was entered, and the UI must say so. |
| **Faire** | Removes risk for retailers: Net 60 terms, plus free returns on opening orders ([Shopify app listing](https://apps.shopify.com/faire-buy-wholesale), [help](https://www.faire.com/support/articles/30874207730331)). | Payment terms are a trust signal. BizYour quotes already carry COD / credit days / advance %, so lead with them on quote cards. |
| **Udaan** | B2B app for small retailers with in-app chat to negotiate, logistics, and credit through udaanCapital ([G2](https://www.g2.com/sellers/udaan), [Business Standard](https://business-standard.com/article/companies/fintech-firm-udaancapital-says-it-enabled-rs-2-200-cr-credit-to-retailers-122092100849_1.html)). | Chat attached to a deal, not a generic inbox. BizYour's quote chat already works this way. |
| Amazon Business, JioMart Partner | Not researched in depth this session. Not verified. | — |

## C. SaaS design references

- **Linear:** keyboard shortcuts for every major action, and a command menu that can do any action ([linear.app](https://linear.app/features/level-up)). Its design refresh used the principle "Don't compete for attention you haven't earned" ([blog](https://linear.app/now/behind-the-latest-design-refresh)).
- **Stripe, Shopify, Mercury, Ramp:** I used them as visual references (tabular numbers, quiet chrome, a single accent colour, money-first hierarchy). I haven't verified specific feature claims about them here.

## Competitive experience matrix

✅ strong · ◐ partial · — absent · ? not verified

| Capability | Vyapar | myBillBook | Tally | Khatabook | Zoho Inv. | IndiaMART | Alibaba | **BizYour (before)** | **BizYour (target)** |
|---|---|---|---|---|---|---|---|---|---|
| Fast counter billing | ✅ | ✅ | ✅ | — | ◐ | — | — | ◐ form-based | ✅ search-first counter |
| Keyboard-complete | ◐ | ? | ✅ | — | ? | — | — | — | ✅ ⌘K + shortcuts |
| Mobile billing | ✅ | ✅ | — | — | ✅ | — | — | ◐ squeezed | ✅ thumb layout |
| Udhaar + reminders | ✅ | ✅ | ◐ | ✅ | ◐ | — | — | ✅ (scattered) | ✅ Collections hub |
| Public customer statement | ? | ? | — | ? | ? | — | — | ✅ hisab link | ✅ |
| GST reports / GSTR-1 | ✅ | ✅ | ✅ | — | ✅ | — | — | ✅ | ✅ |
| Low-stock → reorder | ◐ | ? | ◐ | — | ✅ | — | — | ✅ via Mart | ✅ one tap from Home |
| RFQ / buy requirement | — | — | — | — | — | ✅ | ✅ | ✅ | ✅ |
| Side-by-side quote compare | — | — | — | — | — | ? | ✅ | ◐ list | ✅ table |
| Received order → stock + purchase | — | — | — | — | — | — | — | ✅ | ✅ (shown as a selling point) |
| Hindi / Hinglish UI | ✅ | ✅ | ◐ | ✅ | ? | ✅ | — | ✅ | ✅ |

## Positioning

**Nobody else connects the stock register to the sourcing marketplace.** Billing apps stop at "you're low on Surf Excel". Marketplaces start at "post a requirement" and never see your stock. BizYour's Mart reads low stock, last price and last supplier from the Workspace, and turns a delivered order straight back into a purchase and stock movement.

> **BizYour: the shop counter and the wholesale market in one app.** Bill fast, collect what's owed, and restock from competing suppliers, without typing anything twice.

Target users, in order of priority:
1. **Kirana / general store owner** (first-time software user, phone-first, Hindi/Hinglish). Needs fast billing, udhaar and simple daily numbers.
2. **Growing retailer / small wholesaler** (desktop at the counter, staff, GST). Needs speed, reports, staff permissions and keyboard use.
3. **Wholesaler / distributor as a Mart seller.** Needs a lead inbox, fast quoting and order tracking.

## Gaps BizYour must close

1. Billing speed and keyboard flow. This is table stakes against Vyapar, myBillBook and Tally.
2. Collections need a home of their own.
3. Home needs to show what needs attention, not a stack of every card.
4. A mobile layout designed for one thumb.
5. An honest trust layer in Mart: say what "GST" means, show deals count and ratings, and lead with payment terms.
