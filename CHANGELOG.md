# Operations Hub — What's New in v1

**Version 1.0.0 — August 18, 2026**

This is the first full release of **Operations Hub**, the everyday tool that helps the team receive goods, count stock, and plan re-orders — right from a phone or tablet on the warehouse floor.

## The Big Picture

- **Built for the floor.** Everything works with a Bluetooth barcode scanner and a big, thumb-friendly interface — no desk, no PC, no paperwork needed.
- **One app, three core jobs:** receiving deliveries against purchase orders, doing stock counts, and planning replenishment.
- **Secure and accountable.** Each team member has their own account, and the app records who did what — so audits are a few taps away.

## What's Included

### Logging In

- Secure sign-in with a username and password.
- **Quick login** — returning users can pick their name from a list instead of retyping it.
- **"Remember me"** — stay signed in on your device; sessions time out after 24 hours of inactivity for safety.
- **Role-based access** — admins decide which tools each person can use. Staff see only what they need; supervisors and admins get extra powers like approving exceptions.

### Setting Up (First Run)

- A simple **guided setup wizard** walks the admin through the essentials the first time the app is used: company name, user accounts, which locations each team can see, and delivery preferences.

### Receiving Deliveries

- Pull up an open purchase order, scan each item, and watch the quantity tick up.
- Scan statuses make it obvious what's happening: **exact match**, **over delivered**, **under delivered**, **not on the order**, or **a brand-new item**.
- Mistakes are easy to fix — undo your last scan instantly.
- **Blind delivery mode** (optional): staff scan against the order without seeing the expected quantities, and a supervisor approves any over-deliveries or off-order items before the delivery is saved.
- When you save, the app creates a fresh, correct purchase order with what actually arrived, and closes out the original so it's not counted twice.

### Counting Stock

- Pick a location and scan — each scan adds one to the count.
- Only the items you scan are counted (a "partial count"), so you can count what's in front of you and move on.
- Unknown barcodes are flagged immediately so you can fix them on the spot.
- Counts are saved as an official record — the app never changes your on-hand stock automatically.

### Planning Re-Orders (Replenishment)

- See **everything that needs attention on one screen**, grouped by supplier, with plain-language guidance:
  - **Daily sales rate** — how fast each item sells.
  - **Days of stock (DOS)** — how many days your current stock will last.
  - **Suggested order qty** — the app's recommended amount, adjustable before you submit.
  - **Critical alerts** — items flagged when stock runs dangerously low relative to supplier lead time.
- **Stockout mode** — a special view for items that are sold out, so they don't get forgotten.
- Order in **cases or individual pieces** per line, whichever makes sense.
- **Minimum order reminders** — the app nudges you if a supplier's total is below their usual minimum (advice only — you decide).
- **Printable worksheet** — a paper checklist of what to re-order, with a blank column for notes, one page per supplier.
- Submit orders as proper **purchase orders**, grouped supplier-by-supplier, in one step.

### Keeping a History

- Every completed replenishment run and delivery is saved as an **audit record** — who, what, when, and why.
- Search by PO number, date, location, supplier, or person.
- Export to **CSV** or print a clean, formatted **audit report** for filing.

### Administration

One place for admins to manage everything, tab by tab:
- **Users** — create accounts, reset passwords, assign roles, deactivate staff (nothing is ever hard-deleted).
- **Roles** — decide which tools and powers each role has, and which people belong to it.
- **Location visibility** — control which locations each module shows.
- **Order scheduling** — set each supplier's order day or lead time on a drag-and-drop board, plus optional per-supplier minimums.
- **Delivery & Counting settings** — toggle continuous scanning and blind-delivery mode.
- **Order pooling** — map selling areas to their feeder warehouse so demand is combined automatically.
- **Database** — connect the app to your ActiveOne data without IT help.

## What's Not Here Yet

- Entering bills in ActiveOne (the final step after a superseding PO) is still done manually in ActiveOne.
- Reconciling counting results against on-hand stock is planned as a separate future feature.
- Automated testing is not yet in place.

---

## Update — August 18, 2026

A small refinement shipped since the v1.0.0 release.

### Planning Re-Orders (Replenishment)

- **Optional "Incoming" column.** Admins can now switch off the incoming-stock display with a new setting. When it's off, the Incoming column is hidden and the app counts only what's physically on hand — and the suggested order quantities, days-of-stock, and the printable worksheet all stay consistent with that choice.

---

*This changelog is written for the whole team. For the technical, developer-facing notes, see the repo's `docs/` folder and code comments.*