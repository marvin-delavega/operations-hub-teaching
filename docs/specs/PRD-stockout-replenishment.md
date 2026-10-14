# PRD: Stockout Replenishment
Date: 2026-06-27

## 1. Overview
The standard replenishment run excludes any item with a sales rate of 0. Items that have been out of stock for a long time sell nothing (no stock to sell), so their rate is 0 and they are filtered out — they never surface for reorder, creating a stockout-driven demand-suppression loop where being out of stock hides the very items most in need of restocking. Stockout Replenishment is a second, deliberately-chosen replenishment path that surfaces currently-stocked-out items with prior sales history, estimates their demand from the last period they actually sold, and lets the procurement officer opt in to reordering them.

## 2. Goals
- Surface items that are currently stocked out with nothing incoming but have demonstrable sales history, so they are no longer invisible to replenishment.
- Estimate a defensible daily demand for each from its pre-dormancy sales, without dragging in genuinely dead or never-sold items.
- Force explicit procurement-officer judgment on each candidate (these decisions cannot be automated).
- Reuse the existing replenishment PO flow and write-back so the two paths converge with no second PO code path.
- Add zero cost to the normal (Standard) replenishment run.

## 3. Non-Goals
- Does **not** auto-decide which dormant items to reorder — every item is an opt-in manual judgment.
- Does **not** model demand for items with no sales history anywhere in the rollup (unmodellable).
- Does **not** introduce historical stock-level snapshots; we infer activity from sales history only.
- Does **not** change the Standard replenishment screen, its filters, or its math.
- Does **not** tag or otherwise distinguish stockout-originated POs in ActiveOne.
- Does **not** add a remembered/last-used path or a way to skip the entry fork.

## 4. Users & Roles
- Procurement officer (any authenticated user with replenishment access — not admin-gated).
- Same access model as Standard replenishment; both paths share the same permissions.

## 5. Functional Requirements

**Entry fork**
- FR-1. Tapping the home **Replenishment** card lands on a path-choice screen (not directly into the selection chain).
- FR-2. The path-choice screen presents two large explainer cards: **Standard Replenishment** and **Stockout Replenishment**, each with a short description of its purpose.
- FR-3. The fork is always shown on entry; there is no remembered/last-used path and no skip.
- FR-4. **Standard** proceeds through the existing unchanged chain: location → supplier → standard replenishment screen.
- FR-5. **Stockout** proceeds through **location selection only** → stockout replenishment screen. There is no supplier-selection step.
- FR-6. The "due today" badge remains on the home Replenishment card unchanged (it reflects Standard-path supplier scheduling).

**Qualifying gate**
- FR-7. An item qualifies for the stockout screen only if **effective available (`on_hand + incoming`) = 0** at the selected location — true stockout with nothing on the way. Any open incoming PO disqualifies it.
- FR-8. A qualifying item must have **zero sales within any in-range window** is not required here (no range is selected); instead it must have **at least one sale in the 13-month rollup** to be modellable.
- FR-9. Items with no sales history anywhere in the rollup never appear.
- FR-10. An item appears only if its computed **suggested order quantity > 0** (same base filter as Standard).

**Demand model**
- FR-11. For each qualifying item, find its **most recent sale date** in the `item_sales_daily` rollup at the selected location.
- FR-12. Define a **fixed 30-day window ending at (and including) that last sale date**.
- FR-13. **Daily rate = total base units sold in that 30-day window ÷ 30.** The divisor is **always 30**, even if the item has fewer than 30 days of history before the window start — never divide by a shorter span (prevents single-day-history rate inflation).
- FR-14. Unit conversion follows the existing replenishment rules (flatten to base units, resolve purchase unit + factor, divide); all quantities display in the item's **purchase unit**.

**Suggested order**
- FR-15. Suggested order = `round( daily_rate × (order_period_days + lead_time_days) )`. Because effective available is 0, the `− effective_available` term is 0.
- FR-16. `lead_time_days` is fetched live from `Contact.CUSTOM_FIELD3`. When absent, lead time is treated as **0**.
- FR-17. Rounding direction (up/down) is controlled by the screen's rounding toggle, identical to Standard.

**Screen layout & controls**
- FR-18. Stockout items are **grouped by supplier** in collapsible sections, expanded by default, with a global Expand/Collapse All.
- FR-19. Each supplier group header shows: **supplier name · item count · per-supplier order-period selector (7/14/30)**. No critical badge, no "Due" tag.
- FR-20. Header carries an order-period selector (7/14/30) that sets the default for all groups, plus an up/down rounding toggle. There is **no From/To date range control** (no range concept on this path).
- FR-21. Per-supplier order-period changes immediately re-filter/re-calculate that group (items may appear/disappear as suggested qty crosses 0).
- FR-22. Each item row shows: item name, **unit**, **last-sold date** (or days since last sale), **30-day daily rate**, **units sold in the 30-day window**, and **suggested quantity**. No DOS column, no critical flag.
- FR-23. Items within a group sort **alphabetically by description**.
- FR-24. Group-level and item-level checkboxes exist; **all default unchecked** (opt-in).

**PO generation**
- FR-25. The stockout screen reuses the **identical two-step flow**: Generate PO → Review screen (per-item rounding + qty overrides) → Submit PO.
- FR-26. Submission is **atomic**: the server splits selected lines by supplier into one PO each; any failure rolls back all.
- FR-27. On success, show a per-supplier summary (PO number + count of distinct items), identical to Standard.
- FR-28. Submission updates `supplier_schedule.last_ordered_at` for every supplier involved, creating a `lead_time` record if none exists — identical to Standard.
- FR-29. Stockout-originated POs carry **no special tag or marker** distinguishing them from Standard POs.

## 6. Data Model
No new tables or columns.

- **`item_sales_daily`** (existing app rollup) — source for the 30-day pre-dormancy window. Read may reach back the full ~13 months and trigger the existing compute-live-then-persist self-heal for missing days (expected; first run after a gap may be slower).
- **Live ActiveOne** — on-hand (live), open POs for incoming (live), `Contact.CUSTOM_FIELD3` for lead time (live), unit resolution tables (`item_units`, `PURCHASES_UNIT_ID`/`BASE_UNIT_ID`, `unit_of_measure`).
- **`supplier_schedule`** (existing) — `last_ordered_at` updated on PO submission, as in Standard.
- All stockout-screen data is computed in a **single enriched SQL query** (gate + 30-day window rate + unit resolution), set-based, no per-item round-trips.

## 7. API Contract

**Get stockout candidates**
- Method: GET
- Input: `locationId` (required), plus the active order-period and rounding parameters needed to compute suggested quantity (mirroring the standard screen's parameterization).
- Behavior: returns qualifying items (gate + history + `suggested_order > 0`), grouped/ready for supplier grouping, each with: item id, name, unit symbol, last-sold date, 30-day daily rate, units sold in window, suggested quantity, supplier id/name, resolved unit factor.
- Errors: invalid/missing `locationId` → error response rendered in place of the screen.

**Submit stockout PO** (reuses existing replenishment submit endpoint/behavior)
- Method: POST
- Input: selected lines with final quantities + per-item unit/factor, grouped by supplier.
- Behavior: atomic multi-supplier split; one open PO per supplier written to ActiveOne MySQL; `last_ordered_at` bumped per supplier; rollback all on any failure.
- Output: per-supplier summary (PO number + distinct item count).
- Command-Query Separation preserved: GET computes/reads only; POST writes only.

## 8. UI/UX Flow
1. Home → tap **Replenishment** card (due-today badge still shown) → **path-choice screen**.
2. Path-choice screen → two large explainer cards. Officer taps **Stockout Replenishment**.
3. **Location selection** (location step only; no supplier step). Officer picks a location.
4. **Stockout replenishment screen** loads, scoped to that location, all suppliers:
   - Header: order-period selector (7/14/30), rounding toggle, Expand/Collapse All.
   - Supplier groups (expanded), header = name · count · order-period selector.
   - Item rows show last-sold date, 30-day rate, unit, window units sold, suggested qty; sorted alphabetically by description.
   - All checkboxes unchecked. Officer reviews dormancy context and **opts in** to items/groups worth restocking.
   - Adjusting a group's order period re-calculates that group live.
5. Officer taps **Generate PO** → **Review screen** (per-item rounding/qty overrides, grouped by supplier).
6. Officer taps **Submit PO** → atomic per-supplier write-back → **success summary** (one row per supplier: PO number + distinct item count).

## 9. Edge Cases & Error Handling
- **No qualifying items at location** → friendly empty state ("No stocked-out items with sales history at this location"), not a blank grouped list.
- **No sales history at all** → item excluded entirely (unmodellable).
- **Fewer than 30 days of history** → still divide by 30 (never a shorter span) to avoid rate inflation.
- **Single-day / trivial history** → governed by the divisor-30 rule + `suggested_order > 0` filter; long stale tail managed by recency sort and opt-in, no hard demand floor.
- **Missing supplier lead time (`CUSTOM_FIELD3` null)** → lead time = 0 in the formula; item still surfaces on order-period alone.
- **Invalid/missing `locationId`** → error rendered in place of the screen (mirrors standard scoping behavior).
- **Item restocked between load and submit** → no special handling beyond standard PO submission behavior; PO still writes (officer's decision stands).
- **Deep-history reads** → may trigger rollup self-heal; expected, first run slower then warm.
- **Submission failure for any supplier** → entire submission rolls back; nothing written.

## 10. Open Questions
- None outstanding. (Group ordering across suppliers — alphabetical vs. by most-recent activity — is unspecified; default to alphabetical unless implementation reveals a reason otherwise.)

## 11. Out of Scope / Deferred
- Hard minimum-demand floor (add only if real-world flooding proves it necessary).
- Special audit tagging of stockout-originated POs.
- Historical daily stock-level snapshots / true in-stock-day denominator.
- Remembered/last-used path or fork-skip.
- Surfacing never-sold or brand-new items.
- Case (a) "occasional scattered sales" handling via a smarter in-range denominator — this PRD targets case (b) only (zero in-range sales, history further back).
