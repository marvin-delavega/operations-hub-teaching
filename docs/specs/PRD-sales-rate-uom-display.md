# PRD: Unit of Measure Display in Sales-Rate Module
Date: 2026-06-21

## 1. Overview
Currently, all quantities in the sales-rate module are expressed in base units (pieces),
regardless of how items are purchased or sold. The client purchases inventory by case,
pack, or box — not individual pieces — so the replenishment screen must display all
quantities in each item's purchase unit to be operationally meaningful. This change
affects the main sales-rate screen, the review screen, and the PO write-back to
ActiveOne.

## 2. Goals
- Display daily sales rate, on-hand, incoming, effective available, and suggested order
  in each item's purchase unit rather than base pieces.
- Show the purchase unit's symbol once per row in a dedicated Unit column, eliminating
  repetition across quantity columns.
- Write generated PO lines back to ActiveOne in purchase units with the correct
  conversion factor.
- Update the dev seed to exercise all UOM display paths.

## 3. Non-Goals
- No change to the Days of Supply (DOS) formula — the conversion factor cancels in the
  ratio and the result is identical.
- No per-column unit labels or column-header suffixes — unit is shown once per item row.
- No UOM management UI — units and conversions are read-only from ActiveOne.
- No support for selling-unit display — purchase unit is always the display target.

## 4. Users & Roles
Same as the existing sales-rate module: all authenticated users (staff and admin).
No new permissions introduced.

## 5. Functional Requirements

FR-1: For every item in the sales-rate list, resolve its display unit as follows:
  a. If `item.PURCHASES_UNIT_ID` is non-null and a matching row exists in `item_units`
     (ITEM_ID = item.ID, UNIT_ID = item.PURCHASES_UNIT_ID): use that unit; conversion
     factor = item_units.QUANTITY (base units per 1 purchase unit).
  b. If `item.PURCHASES_UNIT_ID` is non-null but no matching `item_units` row exists:
     use that unit with conversion factor = 1.
  c. If `item.PURCHASES_UNIT_ID` is null: fall back to `item.BASE_UNIT_ID` with
     conversion factor = 1.

FR-2: Flatten all line-level quantities to base units before any conversion:
  - Invoice lines: base = QUANTITY × UNIT_BASE_QUANTITY
  - Sales receipt lines: base = QUANTITY × UNIT_BASE_QUANTITY
  - PO lines (incoming): base = QUANTITY × UNIT_BASE_QUANTITY

FR-3: Convert all computed quantities from base to the item's display unit by dividing
  by the resolved conversion factor from FR-1.
  Affected quantities: daily sales rate, on-hand (ENDING_QUANTITY), incoming (sum of
  open PO undelivered base), effective available, suggested order.

FR-4: The DOS column is computed as effective_available ÷ daily_sales_rate. Both
  values are in the same display unit after FR-3; the formula is unchanged.

FR-5: The suggested order rounding (ceil or floor toggle) is applied after conversion
  to purchase units. The result must be a whole number — no decimal suggested orders.

FR-6: All quantity data per item — unit symbol, conversion factor, and computed
  quantities — must be resolved in a single enriched SQL query at the infrastructure
  layer. No additional per-item round-trips.

FR-7: On the main sales-rate screen, a "Unit" column appears immediately after the
  item name column. It displays the `unit_of_measure.SYMBOL` for the item's resolved
  display unit. All quantity columns (Daily Rate, On-Hand, Incoming, Effective Avail,
  DOS, Suggested Order) display plain numbers with no inline unit labels.

FR-8: On the review screen, the same single Unit column pattern applies. The quantity
  override input is a plain whole-number field. The Unit column to its left provides
  the unit context — no symbol is placed inside or beside the input field.

FR-9: The quantity override input must reject decimal values. Only whole positive
  integers are accepted.

FR-10: When generating a PO and writing lines to ActiveOne, each PO line must be
  written as:
  - UNIT_ID = item.PURCHASES_UNIT_ID (or BASE_UNIT_ID if null)
  - QUANTITY = suggested (or overridden) order quantity in purchase units
  - UNIT_BASE_QUANTITY = resolved conversion factor from FR-1

FR-11: The post-submission summary screen shows one row per supplier with the PO
  number and a count of distinct items ordered (e.g., "4 items") — not a summed
  quantity. This avoids mixing incommensurable units across items.

FR-12: The dev seed (scripts/seed-sales-rate-dev.sql) must be updated to include:
  - At least three unit_of_measure rows beyond "pc" (e.g., Case, Pack, Box with
    distinct symbols).
  - item_units conversion rows for a representative subset of items, covering at least
    three different purchase units.
  - item.PURCHASES_UNIT_ID populated for those items.
  - At least one item per supplier group left at the fallback path (null
    PURCHASES_UNIT_ID or no item_units row) to verify fallback behavior.

## 6. Data Model

### Read (ActiveOne tables, no schema changes)

**item**
- PURCHASES_UNIT_ID (int, nullable) — FK to unit_of_measure; the purchase unit for
  this item.
- BASE_UNIT_ID (int) — FK to unit_of_measure; the base/atomic unit.

**item_units**
- ITEM_ID (int) — FK to item.
- UNIT_ID (int) — FK to unit_of_measure.
- QUANTITY (decimal) — number of base units per 1 unit of UNIT_ID. For example, if
  UNIT_ID is "Case" and QUANTITY is 24, then 1 case = 24 base units.

**unit_of_measure**
- ID (int)
- NAME (varchar) — full name e.g. "Case"
- SYMBOL (varchar) — compact label e.g. "cs"

### Write (PO generation, existing tables)

No schema changes. UNIT_ID and UNIT_BASE_QUANTITY on purchase_order_items are
populated correctly per FR-10 (previously always written as 1/pc).

## 7. API Contract

### GET /sales-rate/api (existing endpoint, extended response)

Each item object in the response gains two new fields:

| Field | Type | Description |
|---|---|---|
| unitSymbol | string | Symbol from unit_of_measure for the resolved display unit |
| unitId | int | ID of the resolved display unit |

All existing quantity fields (dailySalesRate, onHand, incoming, effectiveAvailable,
suggestedOrder) are now expressed in purchase units rather than base units. DOS is
unchanged (ratio is unit-agnostic).

No new endpoints required.

### POST /sales-rate/api (PO generation, existing endpoint)

Request shape unchanged. Server-side, the resolved conversion factor is applied when
writing PO lines (UNIT_ID, QUANTITY, UNIT_BASE_QUANTITY per FR-10).

## 8. UI/UX Flow

### Main sales-rate screen

Column order per item row:
  [ ] Checkbox | Item Name | Unit | Daily Rate | On-Hand | Incoming | Effective Avail | DOS | Suggested Order

- Unit column: shows symbol (e.g., "cs", "pk", "pc"). No quantity in this cell.
- All quantity columns: plain numbers, no suffix.
- Critical flag (DOS < lead time) behavior unchanged.

### Review screen

Column order per item row:
  [ ] Checkbox | Item Name | Unit | Suggested Qty | Override Input

- Unit column: same symbol, same position.
- Override Input: plain whole-number field. Unit column provides context. No symbol
  inside or beside the field.
- Decimal input is rejected; only whole positive integers accepted.

### Post-submission summary screen

One row per supplier:
  Supplier Name | PO Number | Items Ordered

- Items Ordered: count of distinct item lines submitted (e.g., "5 items"), not a
  summed quantity.

## 9. Edge Cases & Error Handling

| Scenario | System Response |
|---|---|
| item.PURCHASES_UNIT_ID is null | Fall back to BASE_UNIT_ID; conversion factor = 1 |
| No item_units row for PURCHASES_UNIT_ID | Use PURCHASES_UNIT_ID for display; conversion factor = 1 |
| unit_of_measure row missing for resolved unit ID | Display empty string for symbol; quantities still shown |
| Override input contains a decimal | Input rejected; field shows validation error inline |
| Override input is zero or negative | Input rejected; must be a positive whole number |
| Item daily sales rate is 0 | Item excluded from list (existing behavior, unchanged) |

## 10. Open Questions

None. All decisions resolved during brainstorm.

## 11. Out of Scope / Deferred

- UOM management or configuration UI.
- Displaying selling-unit quantities alongside purchase-unit quantities.
- Per-supplier UOM normalization (all items within a supplier group may have different
  units — this is intentional and handled by the Unit column per row).
- PO list / edit module (separate planned module, not part of sales-rate).
