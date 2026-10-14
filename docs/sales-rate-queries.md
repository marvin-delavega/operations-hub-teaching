# `sales-rate` — Draft SQL

Concrete queries for the replenishment run, derived from `activeone_no_data.sql`.
Targets MySQL 8 (the dump uses `utf8mb4_0900` collations → CTEs are available).

## Inputs (from the request)
- `:locationId` — single ActiveOne location.
- `:supplierIds` — array of vendor `contact.ID` (the supplier-selection step; also the cost guard on the inventory ledger).
- `:from`, `:to` — sales date range (default last 30 days).

## Values to VERIFY against live data (do not ship guesses)
Pull these into one config object so they're swapped in one place once confirmed:

```ts
// app/(authenticated)/sales-rate/infrastructure/activeoneConstants.ts
export const ACTIVEONE = {
  PO_OPEN_STATUS: 0,          // VERIFY: purchase_order.STATUS meaning "open"
  VENDOR_CONTACT_TYPE: 3,     // VERIFY: contact.TYPE meaning "supplier/vendor"
  INVOICE_VOID_STATUS: null,  // VERIFY: invoice.STATUS value(s) to exclude (voided)
  SR_VOID_STATUS: null,       // VERIFY: sales_receipt.STATUS value(s) to exclude
  LEAD_TIME_FIELD: "CUSTOM_FIELD3", // VERIFY: which contact.CUSTOM_FIELDn holds lead-time days
} as const;
```

> ⚠️ `:supplierIds` is an array. `pool.execute()` (prepared statements) does **not** expand
> `IN (?)` into multiple placeholders — use `pool.query(sql, [ids])`, or build
> `ids.map(() => "?").join(",")` yourself. The blocks below write `IN (:supplierIds)`
> as a stand-in for that expansion.

---

## Query A — Current on-hand (the ledger collapse)

`item_inventory` is an append-only running balance. Current stock = the **latest row per
(item, batch)** at the location (`MAX(SEQUENCE_NO)`), summed across batches. Scoped to the
selected suppliers' items so we never scan the whole ledger.

```sql
SELECT inv.ITEM_ID AS item_id,
       SUM(inv.ENDING_QUANTITY) AS on_hand
FROM item_inventory inv
JOIN (
  SELECT ITEM_ID, BATCH_ID, MAX(SEQUENCE_NO) AS max_seq
  FROM item_inventory
  WHERE LOCATION_ID = :locationId
    AND ITEM_ID IN (
      SELECT ID FROM item
      WHERE INACTIVE = 0 AND PREFERRED_VENDOR_ID IN (:supplierIds)
    )
  GROUP BY ITEM_ID, BATCH_ID
) latest
  ON latest.ITEM_ID  = inv.ITEM_ID
 AND latest.BATCH_ID = inv.BATCH_ID
 AND latest.max_seq  = inv.SEQUENCE_NO
WHERE inv.LOCATION_ID = :locationId
GROUP BY inv.ITEM_ID;
```

`ENDING_QUANTITY` is already in **base units**, so no unit conversion needed here.
Uses index `IX_ITEM_INVENTORY_TRANS_REF (ITEM_ID, LOCATION_ID, BATCH_ID, SEQUENCE_NO, …)`.

---

## Query B — Incoming (open-PO undelivered qty)

PRD: incoming = undelivered qty across **all** open POs at the location, **regardless of PO
origin** — so we scope by item + location + open status, **not** by vendor.

Outstanding is computed in the line's order unit then converted to base units via the
line's own ratio (`UNIT_BASE_QUANTITY` is the base qty for the full ordered `QUANTITY`):

```sql
SELECT poi.ITEM_ID AS item_id,
       SUM(
         (poi.QUANTITY - COALESCE(poi.RECEIVED_QTY, 0))
         * (poi.UNIT_BASE_QUANTITY / NULLIF(poi.QUANTITY, 0))
       ) AS incoming
FROM purchase_order_items poi
JOIN purchase_order po ON po.ID = poi.PO_ID
WHERE po.LOCATION_ID = :locationId
  AND po.STATUS = :PO_OPEN_STATUS          -- VERIFY
  AND COALESCE(poi.CLOSED, 0) = 0
  AND (poi.QUANTITY - COALESCE(poi.RECEIVED_QTY, 0)) > 0
  AND poi.ITEM_ID IN (
    SELECT ID FROM item
    WHERE INACTIVE = 0 AND PREFERRED_VENDOR_ID IN (:supplierIds)
  )
GROUP BY poi.ITEM_ID;
```

---

## Query C — Units sold (off-take), both sources, base units

Wholesale and retail are **separate by design and never merge** — sum both, no de-dup.
Both line tables carry `UNIT_BASE_QUANTITY` (base-unit quantity), which normalizes across
selling units.

```sql
-- Wholesale (invoice) + Retail (sales_receipt), unioned, summed per item.
SELECT s.item_id, SUM(s.qty_base) AS units_sold
FROM (
  -- Wholesale
  SELECT ii.ITEM_ID AS item_id, ii.UNIT_BASE_QUANTITY AS qty_base
  FROM invoice_items ii
  JOIN invoice i ON i.ID = ii.INVOICE_ID
  WHERE i.LOCATION_ID = :locationId
    AND i.DATE BETWEEN :from AND :to
    -- AND i.STATUS <> :INVOICE_VOID_STATUS        -- VERIFY then enable
    AND ii.ITEM_ID IN (
      SELECT ID FROM item WHERE INACTIVE = 0 AND PREFERRED_VENDOR_ID IN (:supplierIds)
    )

  UNION ALL

  -- Retail (POS)
  SELECT sri.ITEM_ID AS item_id, sri.UNIT_BASE_QUANTITY AS qty_base
  FROM sales_receipt_items sri
  JOIN sales_receipt sr ON sr.ID = sri.SALES_RECEIPT_ID
  WHERE sr.LOCATION_ID = :locationId
    AND sr.DATE BETWEEN :from AND :to
    AND COALESCE(sr.RETURN_TRX, 0) = 0
    AND sr.VOID_REFERENCE_NO IS NULL
    -- AND sr.STATUS <> :SR_VOID_STATUS            -- VERIFY then enable
    AND sri.ITEM_ID IN (
      SELECT ID FROM item WHERE INACTIVE = 0 AND PREFERRED_VENDOR_ID IN (:supplierIds)
    )
) s
GROUP BY s.item_id;
```

`days_in_range = DATEDIFF(:to, :from) + 1` — compute in the app, not SQL, so the divisor is
explicit and testable. `daily_rate = units_sold / days_in_range`.

---

## Query D — Master roll-up (one row per candidate item)

Returns the **raw numbers**; the app does the final arithmetic. This is intentional: order
period is per-supplier and adjustable client-side, and `suggested_order` / DOS / rounding /
critical-flagging must recompute instantly when the user changes a group's order period —
cheap in JS, not worth a DB round-trip each time.

```sql
WITH supplier_items AS (
  SELECT it.ID AS item_id, it.CODE, it.DESCRIPTION,
         it.PREFERRED_VENDOR_ID AS supplier_id
  FROM item it
  WHERE it.INACTIVE = 0
    AND it.PREFERRED_VENDOR_ID IN (:supplierIds)
),
on_hand AS ( /* Query A */ ),
incoming AS ( /* Query B */ ),
sold AS ( /* Query C */ )
SELECT
  si.item_id,
  si.CODE                              AS item_code,   -- = scanned barcode
  si.DESCRIPTION                       AS description,
  si.supplier_id,
  c.NAME                               AS supplier_name,
  CAST(NULLIF(c.CUSTOM_FIELD3, '') AS UNSIGNED) AS lead_time_days,  -- VERIFY field
  COALESCE(oh.on_hand,  0)             AS on_hand,
  COALESCE(inc.incoming, 0)            AS incoming,
  COALESCE(sd.units_sold, 0)           AS units_sold
FROM supplier_items si
JOIN contact c ON c.ID = si.supplier_id          -- AND c.TYPE = :VENDOR_CONTACT_TYPE (VERIFY)
LEFT JOIN on_hand  oh  ON oh.item_id  = si.item_id
LEFT JOIN incoming inc ON inc.item_id = si.item_id
LEFT JOIN sold     sd  ON sd.item_id  = si.item_id
WHERE COALESCE(sd.units_sold, 0) > 0;            -- PRD: exclude daily-rate-0 items
```

---

## App-side computation (per row, then per supplier order period)

```ts
const daysInRange   = daysBetweenInclusive(from, to);       // DATEDIFF + 1
const dailyRate     = unitsSold / daysInRange;              // > 0 guaranteed by Query D
const effective     = onHand + incoming;                   // available stock
const dos           = effective / dailyRate;               // Days of Supply (display only)
const round         = roundUp ? Math.ceil : Math.floor;    // header rounding toggle

// per supplier group's order period (7 / 14 / 30), recomputed on change:
const suggested = Math.max(
  0,
  round(dailyRate * (orderPeriodDays + leadTimeDays) - effective)
);

const isCritical = dos < leadTimeDays;                      // flag, not a filter
// surface the item only when suggested > 0 for the group's current order period.
```

This matches the PRD formula exactly:
`max(0, ceil_or_floor( daily_sales_rate × (order_period_days + supplier_lead_time_days) − effective_available ))`.

---

## Notes / edge cases
- **Lead time missing/non-numeric:** `CAST(... AS UNSIGNED)` yields `0` for blank/garbage → suggestion still works but treats lead time as 0. Decide a sensible default once the field is confirmed.
- **`UNIT_BASE_QUANTITY / QUANTITY` in Query B** guards against div-by-zero with `NULLIF`; a line with `QUANTITY = 0` contributes 0 incoming (correct).
- **Performance:** every inner `IN (SELECT ID FROM item WHERE PREFERRED_VENDOR_ID IN (...))` is the cost guard. If supplier sets get large, materialize the item-id list once in the app and pass it directly, or use the `supplier_items` CTE consistently (MySQL 8 will reuse it).
- These queries are **reads only** — PO generation (writes, ID/code minting, atomicity, the ActiveOne-collision fail-over) is a separate step, deferred per earlier discussion.
