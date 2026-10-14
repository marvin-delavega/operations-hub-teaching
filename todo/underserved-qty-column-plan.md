# Implementation Plan: Underserved Quantity Column

Source PRD: `todo/underserved-qty-column-ideas_todo.md`
Date: 2026-08-03

## Summary

Add a display-only "Underserved" column to the Standard replenishment list that shows
`ORDERED_QTY - RECEIVED_QTY` from the most recent ActiveOne PO line per item (within
the last 30 days, Enter Bill must have run). Does not affect the suggestion formula.
Implemented as a new CTE in the `buildCandidatesSQL` query, a new field on
`ReplenishmentItem`, and a new table column in `page.tsx`.

## Affected Areas

### Files to modify

| File | Layer | Change |
|---|---|---|
| `app/(authenticated)/replenishment/domain/ReplenishmentItem.ts:8-25` | domain | Add `underservedQuantity: number` field |
| `app/(authenticated)/replenishment/infrastructure/MySQLReplenishmentRepository.ts:9-27,46-151,208-258` | infrastructure | Add `underserved` CTE + `underserved_qty` column to `CandidateRow` + mapping |
| `app/(authenticated)/replenishment/page.tsx:2227-2229,2469-2478,2297,2376` | ui | Add `Underserved` `<th>` + `<td>`, bump `colSpan` from 10 to 11 |

### No changes to
- `container.ts` — no new dependency (same repository method gains new data)
- `api/route.ts` — GET unchanged (data flows through existing `SupplierGroup`)
- `ReplenishmentRepository.ts` interface — return type `SupplierGroup[]` unchanged (new field on existing type)
- `GetReplenishmentGroupsUseCase.ts` — delegates unchanged
- `create-app-tables.sql` — no new table (read-only from ActiveOne)
- Stockout path — excluded (Tier 3 future consideration)
- Review screen — excluded from initial scope (would duplicate the column read-only)

## Decisions

- **Resolved by AI:**
  - **30-day window from today** (`CURDATE() - INTERVAL 30 DAY`) — the idea doc specifies "1 month only." Not tied to the replenishment date range.
  - **Most recent PO per item** via `ROW_NUMBER() OVER (PARTITION BY ITEM_ID ORDER BY po.DATE DESC) WHERE rn = 1` — resolves "last delivery" unambiguously.
  - **`RECEIVED_QTY > 0` gate** — Enter Bill must have run; POs still pending Enter Bill show `—`.
  - **Floor at 0** via `GREATEST(0, ordered_base - RECEIVED_QTY)` — over-delivery doesn't produce a negative number.
  - **Display `—` when 0 or absent** — matches the existing `incoming` column pattern (line 2469-2477).
  - **Column placement:** between "Incoming" and "Total Stock" — logical adjacency (both describe PO delivery status).
  - **Use `purchase_order.DATE`** for recency ordering — the canonical PO date, not `RECORDED_ON`.
  - **Scope by `LOCATION_ID`** — replenishment is location-scoped; underserved should be too.

- **Assumptions:**
  - The item's current conversion factor (`item_units.QUANTITY` or fallback 1) applies when converting the PO's base-unit underserved qty to purchase units. This may be inaccurate if the PO used a different unit years ago, but is correct for recent POs and is the simplest approach.
  - `purchase_order_items.RECEIVED_QTY` is indeed in base units (confirmed in the existing `incoming` CTE at line 98).
  - MySQL 8 window functions are available (`ROW_NUMBER()`, `OVER()`) — the ActiveOne DB engine supports them.

## Implementation Steps

### Step 1: Domain — add `underservedQuantity` to `ReplenishmentItem`

**File:** `app/(authenticated)/replenishment/domain/ReplenishmentItem.ts`

Add field after `incoming` (line 8):

```ts
/** Underserved qty from the most recent PO in the last 30 days (purchase units). 0 = no underserved or no qualifying PO. */
underservedQuantity: number;
```

**Pattern mirror:** follows `incoming: number` — same type, same conversion (purchase units), same repository mapping pattern.

### Step 2: Infrastructure — add `underserved` CTE to the SQL query

**File:** `app/(authenticated)/replenishment/infrastructure/MySQLReplenishmentRepository.ts`

#### 2a. Add column to `CandidateRow` (line 9-27)

After `unit_cost` field (line 26):
```ts
underserved_qty: string;  // DECIMAL as string; already in purchase units
```

#### 2b. Add `underserved` CTE in `buildCandidatesSQL` (line 46-151)

Insert after the `sold` CTE (before `_dummy`/before `SELECT`). The CTE picks the **single most recent PO line per item** within the 30-day window:

```sql
underserved AS (
  SELECT ranked.item_id, ranked.underserved_base AS underserved_base
  FROM (
    SELECT poi.ITEM_ID AS item_id,
           GREATEST(0,
             poi.QUANTITY * COALESCE(poi.UNIT_BASE_QUANTITY, 1) - poi.RECEIVED_QTY
           ) AS underserved_base,
           ROW_NUMBER() OVER (
             PARTITION BY poi.ITEM_ID ORDER BY po.DATE DESC
           ) AS rn
    FROM purchase_order_items poi
    JOIN purchase_order po ON po.ID = poi.PO_ID
    WHERE po.LOCATION_ID = ?
      AND po.DATE >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      AND poi.RECEIVED_QTY > 0
      AND poi.ITEM_ID IN (SELECT item_id FROM supplier_items)
  ) ranked
  WHERE ranked.rn = 1
),
```

**Key points:**
- `po.LOCATION_ID = ?` — uses the same `locationId` param already in the query (no extra param needed; `?` is positional — verify mysql2 handles duplicate references correctly; technically `pool.query()` does, but we pass `locationId` multiple times already in the params array).
- `po.DATE >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)` — 30-day rolling window from now.
- `RECEIVED_QTY > 0` — Enter Bill must have run.
- `GREATEST(0, ...)` — over-delivery floors to 0.
- `ROW_NUMBER() OVER (PARTITION BY poi.ITEM_ID ORDER BY po.DATE DESC)` — most recent PO wins per item.
- Only items already in `supplier_items` (same scope as the rest of the query).

#### 2c. Add `underserved` to the final SELECT (line 118-136)

Add a new select column after `incoming`:
```sql
COALESCE(us.underserved_base, 0) AS underserved_qty,
```

And add LEFT JOIN:
```sql
LEFT JOIN underserved us ON us.item_id = si.item_id
```

The `si` → `underserved` join goes alongside the existing `LEFT JOIN incoming inc ON inc.item_id = si.item_id`.

Since `underserved_base` is already the **base-unit underserved** (ordered minus received in base units), we divide by `conversionFactor` in the row mapping (Step 2d), matching the pattern used for `on_hand` and `incoming`.

#### 2d. Add params for the new `?` placeholders

The `underserved` CTE has `?` for `LOCATION_ID`. The `buildCandidatesSQL` function already has `locationId` in scope — but the params array is constructed in `getGroups()`. Add the `locationId` param for the `underserved` CTE in both the `hasSellingAreas` and `!hasSellingAreas` branches of the params array (lines 186-202).

Wait — looking at the params more carefully: `locationId` is already passed as `?` for the `on_hand` subquery (`locationId, locationId` at line 190 and 197). The new `underserved` CTE also needs `locationId`. We need to add it to the params array.

In the `hasSellingAreas` branch (line 188-193):
```ts
params = [
  supplierIds,
  locationId, locationId,           // on_hand (inner + outer)
  locationId, PO_OPEN_STATUS,       // incoming
  soldLocationIds, fromStr, toStr,  // sold
  sellingAreaIds, fromStr, toStr,   // shelf
  locationId,                       // underserved
];
```

In the non-selling-areas branch (line 196-201):
```ts
params = [
  supplierIds,
  locationId, locationId,           // on_hand (inner + outer)
  locationId, PO_OPEN_STATUS,       // incoming
  locationId, fromStr, toStr,       // sold
  locationId,                       // underserved
];
```

**Important:** In the `hasSellingAreas` branch, the `sellingAreaIds` params are consumed by the `shelf` CTE. The `underserved` CTE's `?` for locationId comes after `mfgParams` are appended — but actually, no. Let me re-check: the params array is constructed, then `mfgParams` are pushed at line 205. The `manufacturerClause` is injected into the SQL by `buildCandidatesSQL()`. The `underserved` CTE's `?` is a positional placeholder that comes AFTER all previous `?` placeholders.

Let me trace the order of `?` in the SQL:
1. `supplier_items`: `?` for supplierIds
2. `on_hand` inner: `?` for locationId
3. `on_hand` outer: `?` for locationId  
4. `incoming`: `?` for locationId, `?` for PO_OPEN_STATUS
5. `sold`: `?` for locationFilter, `?` for fromStr, `?` for toStr
6. `shelf` (optional): `?` for sellingAreaIds, `?` for fromStr, `?` for toStr
7. `underserved`: `?` for locationId
8. Final WHERE: `?` for mfgParams (if any)

So the params array needs `locationId` at position 7. Let me verify the current params:

Current `hasSellingAreas` params:
```
[supplierIds,           // 1: supplier_items
 locationId, locationId, // 2-3: on_hand inner + outer
 locationId, PO_OPEN_STATUS, // 4-5: incoming
 soldLocationIds, fromStr, toStr, // 6-8: sold
 sellingAreaIds, fromStr, toStr,  // 9-11: shelf
 // + mfgParams pushed later
]
```

Current non-selling-areas params:
```
[supplierIds,           // 1: supplier_items
 locationId, locationId, // 2-3: on_hand inner + outer
 locationId, PO_OPEN_STATUS, // 4-5: incoming
 locationId, fromStr, toStr,  // 6-8: sold
 // + mfgParams pushed later
]
```

After adding `underserved` CTE with `?` for locationId, the new params:

`hasSellingAreas`:
```
[supplierIds,           // 1: supplier_items
 locationId, locationId, // 2-3: on_hand inner + outer
 locationId, PO_OPEN_STATUS, // 4-5: incoming
 soldLocationIds, fromStr, toStr, // 6-8: sold
 sellingAreaIds, fromStr, toStr,  // 9-11: shelf
 locationId,            // 12: underserved
 // + mfgParams pushed later
]
```

`!hasSellingAreas`:
```
[supplierIds,           // 1: supplier_items
 locationId, locationId, // 2-3: on_hand inner + outer
 locationId, PO_OPEN_STATUS, // 4-5: incoming
 locationId, fromStr, toStr,  // 6-8: sold
 locationId,            // 9: underserved
 // + mfgParams pushed later
]
```

#### 2e. Map `underserved_qty` in the row loop (line 238-258)

After line 245 (`incoming`), add:
```ts
const underservedQuantity = Number(row.underserved_qty) / conversionFactor;
```

And add to the `ReplenishmentItem` object:
```ts
underservedQuantity,
```

### Step 3: UI — add column to `page.tsx`

**File:** `app/(authenticated)/replenishment/page.tsx`

#### 3a. Add `<th>` header (after line 2228, before the Total Stock `<th>`)

```tsx
<th className={cn(TH, "text-right")}>Underserved</th>
```

#### 3b. Add `<td>` data cell (after line 2477, before the Total Stock `<td>`)

```tsx
<td className="px-3 py-2 text-right tabular-nums">
  {item.underservedQuantity > 0
    ? <span className="text-warning">{item.underservedQuantity.toFixed(2)}</span>
    : <span className="text-muted-foreground/50">—</span>}
</td>
```

Use `text-warning` token to draw attention (this is a guide signal, not an error), matching the pattern from the minimum-order warning indicator on supplier headers.

#### 3c. Bump `colSpan` from 10 to 11

Two locations:
- Line ~2297: Supplier header row `colSpan`
- Line ~2376: Manufacturer sub-group header row `colSpan`

#### 3d. Update skeleton (loading state)

The skeleton table (around lines 265-308) also needs the column added. Add a `<th>` header and a skeleton `<td>` in the loading rows.

### Step 4: Verify

```bash
npx tsc --noEmit
npm run lint
```

## Risks & Open Questions

- **`ROW_NUMBER()` window function availability:** Assumes MySQL 8+. If the ActiveOne DB runs MySQL 5.7, this won't work. Fallback: a correlated subquery with `ORDER BY po.DATE DESC LIMIT 1` inside a derived table — more verbose but 5.7-compatible.
- **Performance of window function over `purchase_order_items`:** The subquery scans PO lines within the last 30 days for one location, filtered to the selected suppliers' items. Typical volume should be small (hundreds, not millions). If slow, add an index check.
- **Original PO showing full underserved (closed, RECEIVED_QTY = 0):** The `RECEIVED_QTY > 0` gate naturally excludes original POs that were superseded before Enter Bill ran. But if a PO was closed AND Enter Bill ran on it (RECEIVED_QTY > 0), it will still show underserved — which is correct behavior (Enter Bill received less than ordered).
- **Multiple POs for the same item in the window:** Only the most recent contributes. If the most recent PO was exactly served but an older PO was short, the underserved shows 0. This is by design per the idea doc ("last delivery").
