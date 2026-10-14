# Implementation Plan: Safety Stock for Replenishment
Source: `todo/safety-stock-ideas_todo.md`
Date: 2026-08-10

## Summary

Add a Z-score-driven safety stock buffer to Standard replenishment suggestions. Server-side stats (std dev, max daily demand) are computed from `item_sales_daily` in a new CTE; the repository derives safety stock units and a display percentage. A new column on the main screen shows the buffer, the review step makes the percentage editable, and an admin toggle enables/disables the feature (default off). History snapshots record the final safety stock values. Stockout path is excluded.

## Affected Areas

- **Domain**: `app/(authenticated)/replenishment/domain/ReplenishmentItem.ts` — add `safetyStockUnits` field
- **Domain**: `app/(authenticated)/replenishment/domain/ReplenishmentRepository.ts` — add `safetyStock` parameter to `getGroups()`
- **Domain**: `app/(authenticated)/replenishment/domain/PurchaseOrder.ts` — add `safetyStockUnits`, `safetyStockPercent` to `PurchaseOrderLine`
- **Infrastructure**: `app/(authenticated)/replenishment/infrastructure/MySQLReplenishmentRepository.ts` — new `daily_stats` CTE + safety stock computation
- **Infrastructure**: `app/(authenticated)/replenishment/infrastructure/MySQLPurchaseOrderRepository.ts` — write safety stock columns to history
- **Application**: `app/(authenticated)/replenishment/application/GetReplenishmentGroupsUseCase.ts` — pass `safetyStock` flag to repository
- **API**: `app/(authenticated)/replenishment/api/route.ts` — read setting, pass `safetyStock` flag to use case
- **API**: `app/(authenticated)/admin/api/settings/route.ts` — expose + accept `replenishment_safety_stock`
- **Page**: `app/(authenticated)/replenishment/page.tsx` — safety stock column on main screen, editable percentage in review, `POLineState` changes
- **Admin UI**: `app/(authenticated)/admin/ReplenishmentSettingsCard.tsx` — new toggle
- **DB schema**: `scripts/create-app-tables.sql` — idempotent ALTER for `safety_stock_units` + `safety_stock_percent` on `replenishment_run_line`
- **Container**: `container.ts` — update `GetReplenishmentGroupsUseCase` factory signature if needed

## Decisions

- **Resolved by AI**: Standard-only — developer chose stockout exclusion (std dev from 30-day window is meaningless).
- **Resolved by AI**: Absolute add-on model — safety stock units are computed server-side, the percentage is purely informational/editable display. Developer confirmed this model.
- **Resolved by AI**: `STDDEV_SAMP` (sample std dev) for volatility — provides unbiased estimate compared to `STDDEV_POP`.
- **Resolved by AI**: Lead time same source as existing `CUSTOM_FIELD4` — already fetched, no new column.
- **Resolved by AI**: `replenishment_safety_stock` setting key, stored as `"on"`/`"off"` in `app_settings`, default `false` — follows the existing `replenishment_show_all_items` pattern exactly.
- **Assumptions**:
  - Existing filter (`rawOrder <= 0` at `MAX_ORDER_PERIOD`) is NOT modified for safety stock. Items where base demand is already met won't surface even if they'd have safety stock > 0. This avoids the Tier 3 edge case.
  - Safety stock is rounded UP (ceil), consistent with the C# reference code.
  - When safety stock is disabled, the `daily_stats` CTE is omitted entirely (no wasted SQL cost) and `safetyStockUnits` defaults to 0.
  - Percentage display on main screen uses the globally-selected order period's `computeSuggestion()` as denominator. When period changes client-side, the percentage updates, but the absolute safety stock units stay fixed.
  - In review, the user edits the percentage. `safetyStockUnits = ceil(baseSuggestion × editedPct / 100)`. When order period/rounding changes, `baseSuggestion` recomputes and safety stock units recalculate from the (possibly user-edited) percentage.
  - MySQL `STDDEV_SAMP` returns NULL for < 2 data points; we handle NULL → treat std dev = 0 → Z = 0.

## Implementation Steps

### 1. Domain: Add safety stock to `ReplenishmentItem`
**File**: `app/(authenticated)/replenishment/domain/ReplenishmentItem.ts`

Add to `ReplenishmentItem`:
```typescript
safetyStockUnits: number;  // absolute safety stock in purchase units (0 when disabled or std dev = 0)
```

Pattern: existing optional fields (`underservedQuantity`, `sellingAreaDemand`).

### 2. Domain: Add `safetyStock` flag to repository port
**File**: `app/(authenticated)/replenishment/domain/ReplenishmentRepository.ts`

Add `safetyStock?: boolean` parameter to `getGroups()`. Default `false`.

### 3. Domain: Add safety stock fields to `PurchaseOrderLine`
**File**: `app/(authenticated)/replenishment/domain/PurchaseOrder.ts`

Add to `PurchaseOrderLine` (in the "decision context" section, with `path`, `suggestedQty`, etc.):
```typescript
safetyStockUnits: number;
safetyStockPercent: number;
```

### 4. Infrastructure: Add `daily_stats` CTE to `MySQLReplenishmentRepository`
**File**: `app/(authenticated)/replenishment/infrastructure/MySQLReplenishmentRepository.ts`

**4a. Update `CandidateRow`** — add two fields:
```typescript
daily_stddev: number | null;
max_daily_sales: string;  // DECIMAL as string
```

**4b. Update `buildCandidatesSQL()`** — add new `safetyStock?: boolean` parameter. When truthy, insert a `daily_stats` CTE between `sold` and `shelf`:

```sql
daily_stats AS (
  SELECT item_id,
         STDDEV_SAMP(daily_total) AS daily_stddev,
         MAX(daily_total) AS max_daily_sales
  FROM (
    SELECT isd.item_id, isd.sale_date, SUM(isd.units_sold) AS daily_total
    FROM item_sales_daily isd
    WHERE ${soldLocationFilter} AND isd.sale_date BETWEEN ? AND ?
      AND isd.item_id IN (SELECT item_id FROM supplier_items)
    GROUP BY isd.item_id, isd.sale_date
  ) daily
  GROUP BY item_id
),
```

The inner subquery groups by `(item_id, sale_date)` to merge same-day rows from feeder + selling areas before computing std dev.

Add to SELECT:
```sql
COALESCE(ds.daily_stddev, NULL) AS daily_stddev,
COALESCE(ds.max_daily_sales, 0) AS max_daily_sales,
```

Add LEFT JOIN:
```sql
LEFT JOIN daily_stats ds ON ds.item_id = si.item_id
```

When `safetyStock` is falsy, the CTE, SELECT columns, and JOIN are omitted entirely.

**4c. Update `getGroups()`** — accept and forward `safetyStock?: boolean`. Add `daily_stats` params to the param arrays (same values as `sold`: `soldLocationIds, fromStr, toStr`).

**4d. Safety stock computation** in the post-processing loop (after existing unit math):

```typescript
let safetyStockUnits = 0;
if (safetyStock) {
  const dailyStdDev = row.daily_stddev != null ? Number(row.daily_stddev) / conversionFactor : 0;
  const maxDailyDemand = Number(row.max_daily_sales) / conversionFactor;
  if (dailyStdDev > 0) {
    const zScore = Math.max(0, (maxDailyDemand - dailySalesRate) / dailyStdDev);
    safetyStockUnits = Math.ceil(zScore * dailyStdDev * Math.sqrt(leadTime));
  }
}
```

Compute after `dailySalesRate`, `leadTime`, and `conversionFactor` are resolved (around line 245). Pass `safetyStockUnits` into the `ReplenishmentItem` constructor.

### 5. Application: Pass `safetyStock` to use case
**File**: `app/(authenticated)/replenishment/application/GetReplenishmentGroupsUseCase.ts`

The use case already forwards most params to `this.repository.getGroups(...)`. Add `safetyStock?: boolean` to `execute()` and forward it.

### 6. API: Read setting and pass to use case
**File**: `app/(authenticated)/replenishment/api/route.ts`

In `GET`, after reading `replenishment_show_all_items`, also read `replenishment_safety_stock`:
```typescript
const safetyStockRaw = await createGetAppSettingUseCase().execute("replenishment_safety_stock");
const safetyStock = safetyStockRaw === "on";
```

Pass `safetyStock` to `createGetReplenishmentGroupsUseCase().execute(...)`.

### 7. Admin API: Add `replenishment_safety_stock` to settings endpoint
**File**: `app/(authenticated)/admin/api/settings/route.ts`

**GET handler** (line 10-39): Add reading of `replenishment_safety_stock` (alongside `replenishment_show_all_items`). Return as boolean: `null => false`, `"on" => true`.

**PUT handler** (line 43-122): Accept `replenishment_safety_stock` boolean body field, gated by `admin.replenishment_settings` (already checked for `replenishment_show_all_items` — extend the condition). Write `"on"`/`"off"` following the existing boolean-setting pattern.

### 8. Admin UI: Add toggle to ReplenishmentSettingsCard
**File**: `app/(authenticated)/admin/ReplenishmentSettingsCard.tsx`

Add a second toggle below "Show all items" for "Safety stock":
- Label: "Safety stock"
- Description: "On: a Z-score volatility buffer is added to replenishment suggestions for Standard runs. Off: suggestions use demand-only math (no safety buffer)."
- Reads/writes `replenishment_safety_stock` via the same settings API
- Follows the exact same pattern as `showAllItems` — state, loading skeleton, optimistic toggle, save feedback

### 9. Page: Add `safetyStockUnits` to `POLineState`
**File**: `app/(authenticated)/replenishment/page.tsx`

**9a. Extend `POLineState`** (line 149): Add `safetyStockUnits: number` and `safetyStockPercent: number`.

**9b. Read safety stock setting** in the existing `useEffect` that reads `replenishment_show_all_items` (around line 796). Add `safetyStockEnabled` state flag.

**9c. Main screen — safety stock column**:
- Insert a new column in the Standard table, after "DOS" and before "Unit"
- Visible only when `safetyStockEnabled` is true
- Header: "Safety" (short, with tooltip "Safety stock — Z-score volatility buffer")
- Cell: for each item, compute:
  ```typescript
  const baseSuggestion = computeSuggestion(item.dailySalesRate, orderPeriod, item.supplierLeadTime, effectiveAvailable, roundUp);
  const pct = baseSuggestion > 0 ? Math.round(item.safetyStockUnits / baseSuggestion * 100) : 0;
  ```
- Display: `{item.safetyStockUnits} {item.unitSymbol} ({pct > 0 ? '+' : ''}{pct}%)` — using `type-data` mono class
- When `item.safetyStockUnits === 0`: show `—` or empty
- The percentage updates reactively when global `orderPeriod` or `roundUp` changes

**9d. `handleGeneratePO()` — carry safety stock into review**:
When building `POLineState[]` from items (around line 1081 for Standard, 1137 for Stockout), include `safetyStockUnits` from the `ReplenishmentItem`. For stockout lines, set `safetyStockUnits = 0, safetyStockPercent = 0`.

**9e. Adjust `computeSuggestion()` usage**:
The base `computeSuggestion()` DOES NOT include safety stock. `suggestedQty` in POLineState = the demand-only suggestion. `quantity` = base suggestion + safety stock units (until user edits).

**9f. Review — safety stock display and edit**:
- After the "Suggested" column, add a "Safety" column showing: `{line.safetyStockUnits} (+{line.safetyStockPercent}%)`
- The safety stock percentage is an editable `<Input type="number" min={0}>` 
- When the user edits the percentage:
  ```typescript
  const newPct = Number(value);
  const baseSuggestion = line.orderedPerPiece
    ? computeSplitOrder(...).need  // base units for split lines
    : computeSuggestion(...);      // purchase units
  const newSafetyUnits = Math.ceil(baseSuggestion * newPct / 100);
  setLineSafetyStock(sku, newPct, newSafetyUnits);
  ```
  This also updates `line.quantity = baseSuggestion + newSafetyUnits` (in cases) or adjusts the split for per-piece lines.
- When period or rounding changes on a line: recompute `baseSuggestion`, keep `safetyStockPercent` as-is, recalculate `safetyStockUnits = ceil(newBase * pct / 100)`, update `quantity`.

**9g. Per-piece integration**:
When a line is in split mode (`orderedPerPiece = true`), safety stock is computed in base units and split into cases + pieces alongside the base suggestion. The total need = `baseNeed + safetyStockBase`, then split: `totalPieces = ceil((baseNeed + safetyStockBase) * factor)`, divided into cases + remainder pieces.

### 10. Infrastructure: Write safety stock to history
**File**: `app/(authenticated)/replenishment/infrastructure/MySQLPurchaseOrderRepository.ts`

**10a.** In `persistRunSnapshot()` (line 398-418), add two values to the `lineValues` arrays (after `stockoutWindowUnits`):
```typescript
line.safetyStockUnits ?? 0,
line.safetyStockPercent ?? 0,
```

**10b.** Update the INSERT column list to include:
```sql
safety_stock_units, safety_stock_percent
```

Pattern: identical to how `last_sold_date`, `stockout_daily_rate`, `stockout_window_units` are written (nullable stockout-only columns on the same table).

### 11. DB Schema: Idempotent ALTER for `replenishment_run_line`
**File**: `scripts/create-app-tables.sql`

Add two idempotent ALTER blocks (after the existing `ordered_per_piece` block, around line 405):

```sql
-- Idempotent addition of safety_stock_units to existing `replenishment_run_line` installs.
SET @rrl_has_safety_stock_units := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'replenishment_run_line' AND COLUMN_NAME = 'safety_stock_units'
);
SET @add_rrl_safety_stock_units := IF(
  @rrl_has_safety_stock_units = 0,
  'ALTER TABLE `replenishment_run_line` ADD COLUMN `safety_stock_units` int NOT NULL DEFAULT 0 AFTER `ordered_per_piece`',
  'SELECT 1'
);
PREPARE add_rrl_safety_stock_units_stmt FROM @add_rrl_safety_stock_units;
EXECUTE add_rrl_safety_stock_units_stmt;
DEALLOCATE PREPARE add_rrl_safety_stock_units_stmt;

-- Idempotent addition of safety_stock_percent to existing `replenishment_run_line` installs.
SET @rrl_has_safety_stock_percent := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'replenishment_run_line' AND COLUMN_NAME = 'safety_stock_percent'
);
SET @add_rrl_safety_stock_percent := IF(
  @rrl_has_safety_stock_percent = 0,
  'ALTER TABLE `replenishment_run_line` ADD COLUMN `safety_stock_percent` decimal(10,2) NOT NULL DEFAULT 0 AFTER `safety_stock_units`',
  'SELECT 1'
);
PREPARE add_rrl_safety_stock_percent_stmt FROM @add_rrl_safety_stock_percent;
EXECUTE add_rrl_safety_stock_percent_stmt;
DEALLOCATE PREPARE add_rrl_safety_stock_percent_stmt;
```

### 12. Container: Update factory if needed
**File**: `container.ts`

If `GetReplenishmentGroupsUseCase.execute()` signature changes (new `safetyStock` param), the factory in `createGetReplenishmentGroupsUseCase()` may need adjustment. But since `execute()` forwards to `repository.getGroups()` and we pass `safetyStock` at call time (not construction time), the factory itself likely stays unchanged. Only the callers in the API route need updating.

### 13. Verify
- `npx tsc --noEmit` — no type errors
- `npm run lint` — no ESLint errors (no raw colors, motion-safe, no font-mono without `type-data`)
- Verify admin toggle persists and reads back correctly
- Verify main screen column appears/hides based on setting
- Verify review editing works with period/rounding changes
- Verify history INSERT includes new columns

## Risks & Open Questions

- **STDDEV_SAMP on sparse data**: If an item has only 1-2 sales days in the range, std dev will be NULL or very noisy. The code handles NULL → Z = 0 (no safety stock), which is conservative.
- **Performance**: The `daily_stats` inner query groups by `(item_id, sale_date)` across potentially many rows. The `item_sales_daily` table is indexed on `(location_id, sale_date)` — verify this covers the query plan. A missing index could make the std dev computation slow on large rollup tables.
- **Percentage vs. absolute sync on review**: When the user edits the percentage and then changes the order period, `baseSuggestion` changes, which changes `safetyStockUnits` (derived from pct × new base). This is intentional per the assumption above, but verify the UX feels correct.
- **Worksheet**: Safety stock is not shown on the worksheet (Tier 3/deferred). If worksheet mode is used, `safetyStock` should be passed as `false` or the column should be hidden.
- **Filter interaction**: Items with adequate stock (rawOrder ≤ 0) won't surface even with safety stock > 0. This is an explicit choice for now (Tier 3).
