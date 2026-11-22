# 03 — Product strategy, information architecture and design system

## Design principles

1. **The counter comes first.** Billing is the most frequent job, so it gets one key (N), one tab on mobile, and a full-screen layout.
2. **Show what needs attention.** Home answers *How am I doing? What needs attention? What next?* and nothing else.
3. **Organise by job, not by table.** Sell · Collect · Stock · Money · Mart. That replaces Products / Purchases / Suppliers / New Bill / Estimates / …
4. **Every number is a door.** Click a figure and you land on the list behind it.
5. **Keyboard-complete, touch-native.** ⌘K / Ctrl+K reaches every screen and action. On a phone the same actions are one thumb away.
6. **Be honest.** No fake badges, no fake features. If a capability lives in the classic screen for now, the link says so.

## Information architecture

```
BizYour
├── Home                      dashboard: today, attention, next steps
├── Sell
│   ├── New bill (POS)        N   full-screen counter
│   └── Bills                 bills · estimates · returns (tabs)
├── Collect
│   └── Customers & udhaar    list → customer page (bills, payments, remind, hisab link, vasuli)
├── Stock
│   ├── Products              table + drawer detail, low/out filters, import/export
│   ├── Purchases             list → purchase detail, record payment
│   └── Suppliers             list with payable
├── Money (owner)
│   ├── Expenses
│   └── Reports               summary, GST, GSTR-1, monthly, day-end
├── Mart
│   ├── Buy                   inquiries, quotes, compare, orders
│   └── Sell                  leads, quotes sent, orders, catalog, profile
└── Settings · Staff · Subscription · Backup · History · Help
```

Workspace and Mart share **one shell**. Mart is a group in the same sidebar, with its own amber accent and notification count. It isn't a separate mode you toggle into, because the value of Mart *is* that it's connected to your stock.

**Mobile:** a bottom bar with Home · Bills · **＋ Bill** (centre, primary) · Customers · More. "More" opens a sheet with every other destination.

**Staged rollout (honest):** Home, New bill, Bills, Customers, Products, Purchases, Suppliers and all of Business Mart are rebuilt in the new app. Every other destination opens the existing screen at `/classic/` with the same login. Nothing is removed. See `docs/06-PROGRESS.md`.

## Key journeys

| Journey | Before | After |
|---|---|---|
| Walk-in sale | Nav → New Bill → "+ Add item" → pick from dropdown → qty → save | Press **N** (or tap ＋) → type "atta" ↵ → type "chee" ↵ → **Enter** to charge cash (or F2 UPI / F3 udhaar) |
| Udhaar sale | Same form + pick customer from a long select | In the counter, press **C** → type name → pick. Balance after the bill is shown before saving |
| Collect a payment | Customers → scroll → customer → payment form | Home "To collect" → customer → **Record payment** (vasuli spread across bills) or **Remind on WhatsApp** |
| Restock | Mart → Restock tab | Home "Low stock" → **Restock on Mart** (prefilled inquiry) |

## Visual direction: chosen "Ledger"

Four directions were compared against trust, speed, Indian shop context, Hindi rendering and how they'd age:

| Direction | Verdict |
|---|---|
| Enterprise blue (status quo, Zoho-like) | Safe but anonymous. Blue-on-blue gives no hierarchy, and it's what the old UI already was. |
| Commerce-first bold (Shopify/Udaan) | Energetic, but loud colour fights with money semantics (red/green). |
| Fintech minimal (Mercury/Ramp) | Beautiful, but cold and English-first. Dark mode hurts readability on a sunlit counter. |
| **Ledger: modern bahi-khata** | Warm paper canvas, ink text, one deep-green accent from the logo's ribbon, tabular numbers set like a ledger. It feels familiar to a shopkeeper and still reads as serious software. **Chosen.** |

### Tokens (implemented in `web/src/styles/tokens.css`)

- **Colour.** Canvas `#F6F5F1` (paper) · surface `#FFFFFF` · sunken `#EFEDE7` · ink `#17181C` / `#4A4D55` / `#7C7F87` · line `#E3E0D8`. Accent **Bahi green** `#0B6E4F`, with hover `#095A41` and tint `#E4F1EB`. Mart amber `#C27C0E` on `#FBF1DE` (darkened from `#F5A524` to pass contrast as text). Money: in `#137A3A`, owed `#B4321F`, warn `#A15C00`.
- **Type.** IBM Plex Sans + IBM Plex Sans Devanagari (bundled, so they work offline). Numbers use `font-variant-numeric: tabular-nums`. Scale: 12 / 13 / 14 (base) / 16 / 20 / 24 / 32.
- **Space.** 4-pt scale: 4, 8, 12, 16, 20, 24, 32, 40, 56.
- **Radius.** 6 for inputs and buttons, 10 for cards, 14 for sheets.
- **Shadow.** Almost none: hairline borders carry structure, and one soft shadow is reserved for overlays.
- **Motion.** 120 ms on hover/press, 180 ms for drawers. Respects `prefers-reduced-motion`.
- **Icons.** Lucide, 1.75 stroke, 16/18/20. Emoji are no longer used as icons.

### Components

Button (primary / secondary / ghost / danger, sm/md/lg, with keyboard hint) · IconButton · Input / Select / Textarea with label, hint and error · SearchField · Money (formats ₹, tabular, signed colour) · Badge (status) · Card · Stat (label, value, delta, link) · Table (sticky header, numeric right-align, row click) · Tabs · Drawer (right on desktop, bottom sheet on mobile) · Modal · Toast · EmptyState · Skeleton · CommandPalette · Segmented control · Kbd.
