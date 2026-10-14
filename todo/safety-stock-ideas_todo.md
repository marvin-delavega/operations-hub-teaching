# Safety Stock — Feature Ideas

Captured 2026-08-10. Not yet scoped — each Tier 1 item likely warrants its own
PRD before implementation.

Context: The replenishment module currently suggests order quantities as
`daily_sales_rate × (period + lead_time) − effective_available`, with no
buffer for demand volatility. Safety stock adds a Z-score-driven buffer derived
from the item's own daily sales history in `item_sales_daily`, computed
server-side as an absolute unit add-on to the suggested qty, and displayed as a
percentage (e.g. "100 (+3%)").

### Core formula (per-item, server-side)
```
zScore           = max(0, (maxDailyDemand − avgDailyRate) / dailyStdDev)
safetyStockUnits = ceil(zScore × dailyStdDev × sqrt(leadTimeDays))
displayPct       = round(safetyStockUnits / suggestedQty × 100)
```

Zero std dev → Z = 0 → no safety stock. Stats source: `item_sales_daily`
(already scoped to the same location + feeder/selling-area set as the main
`sold` CTE). Lead time is the same `CUSTOM_FIELD4` already fetched.

---

## Tier 1 — Highest value (core feature)

- [ ] **Server-side safety stock computation** — Extend
  `MySQLReplenishmentRepository.getGroups()` with a new `daily_stats` CTE
  computing `STDDEV(units_sold)` and `MAX(units_sold)` per item from
  `item_sales_daily` over the same date range + location set. Post-process
  rows to compute Z-score → safety stock units → display percentage.
  Convert base-unit stats to purchase units via the existing
  `conversionFactor`. Needs a dedicated CTE (current `sold` CTE only
  aggregates `SUM`). Add `safetyStockUnits` (number) and
  `safetyStockPercent` (number) to `ReplenishmentItem`.

- [ ] **Safety stock column on main screen** — New dedicated column between
  "DOS" and "Unit" showing `{qty} (+{pct}%)` for items where safety stock >
  0. Empty/hidden when disabled. Uses mono font (`type-data`). Respects the
  global settings toggle.

- [ ] **Editable safety stock in review** — In the PO review step, the
  safety stock percentage (not units) is an editable numeric input next to
  the suggested/safety display. Editing the percentage recalculates
  `safetyStockUnits = ceil(suggestedQty × pct / 100)`. When the user changes
  the order period or rounding on a line, `suggestedQty` recomputes, and
  `safetyStockUnits` stays at its absolute value (computed or edited) — the
  displayed percentage updates to reflect the new ratio. Safety stock is
  always rounded up.

- [ ] **Admin toggle** — Add `replenishment_safety_stock` setting
  (default `"off"`) in the Replenishment tab of `/admin`, gated by
  `admin.replenishment_settings`. Follow the existing settings card pattern
  (`ReplenishmentSettingsCard.tsx`). When off: no stats computed, no column
  shown, no percentage on review, safety stock = 0 in PO lines.

---

## Tier 2 — Strong, moderate effort

- [ ] **Integration with per-piece ordering** — When a line is ordered per
  piece, safety stock should be expressible in base units and divided into
  cases + pieces alongside the main qty. The safety stock percentage applies
  to the total need in base units before the case/piece split.

- [ ] **History persistence** — Add `safety_stock_units` and
  `safety_stock_percent` columns to `replenishment_run_line` (idempotent
  ALTER pattern in `create-app-tables.sql`). Write at PO commit time so
  historical runs retain the numbers at the moment of decision. Not shown as
  a separate column in history exports — only in detail view.

---

## Tier 3 — Convenience / workflow

- [ ] **Zero-suggested items with safety stock** — Currently, items where
  `rawOrder <= 0` at the max period are filtered out. Safety stock could
  push an item from "don't need" to "need some buffer." Decide whether to
  surface these (e.g. item needs 0 cases but 2 cases of safety buffer).
  Likely separate from the main feature.

- [ ] **Safety stock floor/ceiling per supplier or item** — Optional
  per-item or per-supplier minimum/maximum safety stock, configurable in
  Admin. Defers to a future PRD.

---

## Open questions for the PRD phase

1. **Stockout path** — Stockout replenishment has a 30-day window anchored on
   the last sale date, not continuous daily data. Std dev can't be meaningfully
   computed from a single window. Should safety stock be excluded from stockout
   entirely, or use a different model (e.g. fixed percentage)?

2. **Filter interaction** — If an item's raw suggested qty = 0 but safety stock
   > 0, should the item surface on the list? (Currently filtered out by the
   `rawOrder <= 0` guard in the repository.) The answer affects the WHERE logic
   in the `getGroups` post-processing.

3. **Percentage display when suggested = 0** — If suggested qty rounds to 0 but
   safety stock > 0 (e.g. 0 (+2)), what should display? Zero-denominator
   percentage is undefined. A sentinel like `0 (+∞)` or suppress percentage
   display may be needed.

4. **Worksheet integration** — Should safety stock appear in the worksheet
   printout? The worksheet shows all items including 0-qty; safety stock might
   be relevant for administrator annotation.

## Suggested starting point

Start with Tier 1 core — it's self-contained (server-side stats + UI column +
review edit + toggle). Tier 2 (piece integration + history) can follow
immediately since they touch the same files. Tier 3 edge cases should be decided
during PRD.
