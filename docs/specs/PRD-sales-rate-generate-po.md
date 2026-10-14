# PRD: Sales Rate & Generate PO
Date: 2026-06-17

## 1. Overview
The sales-rate module is a replenishment planning tool for warehouse staff at Davao Great Wall
Trading. It computes a dynamic daily sales rate from a user-selected date range, identifies
inventory items that need reordering based on Days of Supply, and generates Purchase Orders
written directly to the ActiveOne ERP MySQL database. The module replaces a per-supplier
workflow with a single unified replenishment run — all suppliers, one process.

## 2. Goals
- Surface only items that need attention (DOS below a user-set threshold), not the entire catalog.
- Compute daily sales rate dynamically from a user-selected date range, not a stored static value.
- Flag items in their supplier's danger zone (DOS < supplier lead time) as critical.
- Allow review and per-item quantity adjustment before final submission.
- Submit all POs atomically — all succeed or all roll back — and display a post-submit summary.

## 3. Non-Goals
- Live ERP sales query (deferred — mock data only for prototype).
- Role-based access control (deferred to a dedicated topic).
- PO list, PO edit, and PO history (separate module, deferred).
- Pagination (all surfaced items shown in a single scrollable list).
- API-based ERP integration (ActiveOne has no API; all writes are direct DB).

## 4. Users & Roles
- All authenticated users can access this module for the prototype.
- Role-based restrictions are deferred.

## 5. Functional Requirements

### Header Controls

FR-1  The page header contains four controls applied globally to the entire view:
      - **Date Range** — From and To date pickers. Default: last 30 days ending today.
      - **DOS Threshold** — numeric input (days). Default: 7.
      - **Order Period** — selector: 7 days / 14 days / 30 days. Default: 7 days.
      - **Rounding** — toggle: Round Up / Round Down. Default: Round Up.
      Changing any header control immediately recomputes and re-renders the item list.

FR-2  Daily sales rate for each item is computed on-demand from the selected date range:
      `daily_sales_rate = total_units_sold_in_range ÷ number_of_days_in_range`

### Item Surfacing & Flagging

FR-3  Only items where `DOS < DOS threshold` are shown. Items above the threshold are hidden.
      `DOS = available_stock ÷ daily_sales_rate`
      Items with a daily sales rate of 0 are excluded (no consumption = not a replenishment candidate).

FR-4  Each item is evaluated for a **critical flag**:
      An item is critical when `DOS < supplier_lead_time_days`.
      Critical items are visually distinguished (e.g., highlighted row or icon).

FR-5  Within each supplier group, items are sorted by DOS ascending — most urgent first.

### List Layout

FR-6  Surfaced items are grouped by supplier. Each supplier group is a collapsible section,
      expanded by default.

FR-7  Each supplier group header displays:
      - Supplier name
      - Total item count in the group
      - Count of critical items in the group (e.g., "14 items · 3 critical")
      - A group-level expand/collapse control
      - A group-level checkbox (selects/deselects all items in the group)

FR-8  A global **Expand All / Collapse All** toggle appears above the supplier group list,
      giving the user a high-level overview across all suppliers at once.

FR-9  Each item row displays:
      - SKU
      - Item Description
      - Supplier Lead Time (days)
      - Available Stock
      - Daily Sales Rate (computed)
      - Days of Supply (computed)
      - Suggested Order Quantity (computed; see FR-12)
      - Critical flag indicator (if applicable)
      - Row-level checkbox

FR-10 Each row is expandable to show a per-location breakdown of:
      Available Stock and Daily Sales Rate.

### Suggestion Formula

FR-11 Suggested order quantity:
      `ceil_or_floor( daily_sales_rate × (order_period_days + supplier_lead_time_days) )`
      Rounding direction is determined by the global Rounding toggle.

### Selection & Generation

FR-12 All surfaced items are checked by default. The user may:
      - Uncheck individual items to exclude them.
      - Uncheck a supplier group header to exclude all items under that supplier.
      - Partially check a group (individual unchecks cause the group checkbox to show
        an indeterminate state).

FR-13 A **"Generate PO"** button is always visible in the header or a sticky footer.
      It is disabled when zero items are selected.
      Clicking it advances to the PO Review screen with only the selected items.

### PO Review Screen

FR-14 The PO Review screen groups selected items by supplier, mirroring the main list layout.
      Each supplier group is collapsible, expanded by default.

FR-15 Each item row on the review screen shows:
      - SKU, Description
      - A per-item Order Period selector (7 / 14 / 30 days), pre-set to the global choice
      - A per-item Rounding toggle, pre-set to the global choice
      - Computed suggested quantity
      - An editable quantity field the user can override manually

FR-16 A **"Submit PO"** button submits all POs atomically. The system creates one PO per
      supplier group from the reviewed items.

### Submission & Outcome

FR-17 Submission is atomic: if any single PO write fails, all PO writes are rolled back.
      No partial state is committed to the database.

FR-18 On successful submission, a **Summary screen** is shown displaying:
      - One row per supplier: Supplier Name · PO Number · Total Quantity Ordered
      - A "Done" action that returns the user to the sales rate screen with header
        controls restored to their previous state.

FR-19 On submission failure, an error message is shown on the Review screen.
      The user remains on the review screen and may retry.

### Empty States

FR-20 If no items meet the DOS threshold after calculation, an empty state message is shown:
      e.g., "No items currently below [X] days of supply. Try increasing the threshold or
      adjusting the date range."

## 6. Data Model

### SalesRateItem (computed — mock for prototype)
| Field                | Type    | Notes                                                    |
|----------------------|---------|----------------------------------------------------------|
| sku                  | string  | Unique item identifier                                   |
| description          | string  | Item name                                                |
| supplierId           | string  | FK to Supplier                                           |
| supplierName         | string  | Denormalized for display                                 |
| supplierLeadTime     | number  | Days; used in suggestion formula and critical flag       |
| availableStock       | number  | Total across all locations                               |
| dailySalesRate       | number  | Computed: total units sold in range ÷ days in range      |
| daysOfSupply         | number  | Computed: availableStock ÷ dailySalesRate                |
| isCritical           | boolean | Computed: daysOfSupply < supplierLeadTime                |
| locations            | array   | Per-location breakdown                                   |

### SalesRateItemLocation
| Field            | Type   | Notes                    |
|------------------|--------|--------------------------|
| locationName     | string |                          |
| availableStock   | number |                          |
| dailySalesRate   | number |                          |

### PurchaseOrder (write — ActiveOne MySQL)
| Field      | Type   | Notes                           |
|------------|--------|---------------------------------|
| poNumber   | string | Generated by ERP / DB on insert |
| poDate     | date   | Date of generation (today)      |
| supplierId | string |                                 |
| lines      | array  | One entry per selected item     |

### PurchaseOrderLine
| Field       | Type   | Notes                         |
|-------------|--------|-------------------------------|
| sku         | string |                               |
| description | string |                               |
| quantity    | number | Final user-confirmed quantity |

## 7. API Contract

### GET /sales-rate/api?from={date}&to={date}&dosThreshold={days}
Returns all items where computed DOS < dosThreshold, grouped by supplier, sorted by DOS
ascending within each group. Daily sales rate is computed server-side from the date range.
Response:
```
{
  "groups": [
    {
      "supplierId": "string",
      "supplierName": "string",
      "leadTimeDays": number,
      "items": SalesRateItem[]   // sorted by daysOfSupply asc
    }
  ]
}
```

### POST /sales-rate/api/po
Submits one or more POs atomically. The server splits lines by supplierId and writes one
PO record per supplier. All writes succeed or all are rolled back.

Request body:
```
{
  "poDate": "string (ISO date)",
  "lines": [
    {
      "sku": "string",
      "description": "string",
      "supplierId": "string",
      "quantity": number
    }
  ]
}
```
Response (success):
```
{
  "pos": [
    { "supplierId": "string", "supplierName": "string", "poNumber": "string", "totalQuantity": number }
  ]
}
```
Response (failure): `{ "error": "string" }`

## 8. UI/UX Flow

1. User opens /sales-rate.
2. Header controls are shown with defaults: last 30 days · DOS threshold 7 · Order period 7 days · Round Up.
3. System fetches and displays items below DOS threshold, grouped by supplier, expanded.
4. User sees group headers with item count and critical count badges.
5. User reviews items (sorted by DOS ascending within each group).
6. User adjusts header controls as needed — list recomputes immediately.
7. User collapses/expands supplier groups as needed using group controls or Expand All / Collapse All.
8. User unchecks any items or whole supplier groups to exclude.
9. User taps "Generate PO".
10. PO Review screen appears — items grouped by supplier, all previously selected items shown.
11. User adjusts per-item period, rounding, or quantity overrides.
12. User taps "Submit PO".
    - Success: Summary screen shows one row per supplier (PO number + total quantity). User taps Done → returns to sales rate screen.
    - Failure: Error message on review screen. All PO writes rolled back. User can retry.

## 9. Edge Cases & Error Handling

| Scenario                                          | Expected Behavior                                                        |
|---------------------------------------------------|--------------------------------------------------------------------------|
| No items below DOS threshold                      | Empty state message with guidance to increase threshold or adjust dates  |
| Daily sales rate is 0 for an item                 | Item excluded from list (not a replenishment candidate)                  |
| Suggested quantity rounds to 0                    | Show 0; item still selectable; user can override before submitting       |
| All items deselected, Generate PO clicked         | "Generate PO" is disabled; cannot proceed                               |
| DOS threshold changed after partial deselection   | List recomputes; user selection is reset to all-checked                  |
| ERP write fails on Submit (any PO)                | All PO writes rolled back; error shown on review screen; user can retry  |
| Supplier group fully deselected                   | Group checkbox shows unchecked; group excluded from PO review            |
| Partial group selection                           | Group checkbox shows indeterminate state                                  |

## 10. Open Questions

- What are the exact ActiveOne MySQL table and column names for:
  (a) reading sales transactions (invoices / sales receipts) to compute daily sales rate?
  (b) reading available stock and supplier lead time per item?
  (c) writing PO header and PO line records?
- What does the ActiveOne PO number sequence look like — auto-increment, prefixed string?
- Should the PO date default to today or be user-selectable on the review screen?
- Is there a maximum number of POs the system should create in a single atomic run?

## 11. Out of Scope / Deferred
- Live ERP sales query (mock data used for prototype)
- Role-based access control
- PO list and PO edit (separate module)
- Pagination
- API-based ERP integration
- Per-item reorder point from ERP as an additional surfacing signal (deferred — DOS threshold covers the use case for now)
