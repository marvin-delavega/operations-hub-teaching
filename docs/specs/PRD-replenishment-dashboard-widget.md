# PRD: Replenishment Dashboard Widget
Date: 2026-06-22
Updated: 2026-06-24 — badge metric changed from "critical stock" to "items to order".

## 1. Overview
The home screen's Replenishment module card is replaced with a live dashboard widget that surfaces,
per location and supplier, the count of **items that need ordering** — items whose suggested order
quantity is greater than zero for the shortest order period (7 days). Staff see at a glance where
action is needed without navigating into the replenishment module. The widget links directly into
the replenishment screen with filters pre-applied, and a "Plan Replenishment" button starts the full
selection flow.

> Note: an earlier version of this widget counted *critical* items (Days of Supply below the
> supplier lead time). It now counts items to order, so the badge matches what the replenishment
> screen lists when a supplier's order period is set to 7 days.

## 2. Goals
- Surface items needing an order immediately on login, with no manual navigation required.
- Eliminate the need for staff to routinely open the replenishment module just to check whether
  anything needs ordering.
- Keep the home screen fast — dashboard data is pre-computed, not queried live on every load.
- Auto-update the dashboard after a PO is submitted so the widget reflects the new incoming stock.

## 3. Non-Goals
- Push notifications, SMS, or email alerts (deferred to a future iteration).
- Per-user or per-supplier ownership or routing of alerts.
- Surfacing items with no current order need (suggested order qty = 0) on the dashboard.
- Showing individual item names or quantities on the home screen widget.
- Configurable date range, order period, or rounding on the widget (fixed at a 30-day sales window
  and a 7-day order period).

## 4. Users & Roles
- All authenticated users (staff and admin) see the widget.
- No role-based differences in what is shown.
- Read access only — the widget is informational; actions happen in the replenishment module.

## 5. Functional Requirements

FR-1: The home screen layout places the replenishment dashboard widget in the left column and
      the remaining module cards in a grid to the right.

FR-2: On narrow screens (mobile phones), the dashboard widget stacks above the module card grid.

FR-3: The widget fetches data from the pre-computed replenishment_summary table on mount.

FR-4: The widget displays a manual refresh button. Tapping it triggers a recompute of the
      replenishment_summary table and updates the widget with fresh data.

FR-5: The widget displays a "last refreshed" timestamp showing when the data was last fetched
      (computed client-side from the last successful fetch — not stored in the DB).

FR-6: When items need ordering, the widget lists rows grouped by location, then supplier, each
      showing the supplier name and a badge with the count of items to order.

FR-7: Each row is a tappable link that navigates directly to
      /replenishment?locationId={id}&supplierIds={id}, bypassing the location and supplier
      selection screens.

FR-8: A "Plan Replenishment" button appears in the widget footer and starts the full flow:
      /location?module=replenishment&returnTo=%2Fsupplier%3FreturnTo%3D%2Freplenishment

FR-9: When no items need ordering across all locations, the widget shows an "All clear" empty
      state with a green tint and check icon to confirm data loaded successfully (not an error).

FR-10: After a PO is successfully submitted via the replenishment module, the server
       automatically triggers a recompute of the replenishment_summary table before
       responding to the client.

FR-11: An item is counted when its suggested order quantity is > 0 for a 7-day order period:
       `daily_sales_rate × (7 + lead_time_days) − effective_available > 0`. This mirrors the
       replenishment screen's per-item filter at the shortest order period under the default
       round-up rounding (where "suggested > 0" reduces to "raw need > 0"). Lead time is read from
       Contact.CUSTOM_FIELD3 (treated as 0 days when null/empty). Daily sales rate uses a fixed
       sales window of the last 30 days, divided by 31 (the inclusive day count of the
       CURDATE()-30 .. CURDATE() span) to match the replenishment screen's default range.

FR-12: Items with a daily sales rate of zero are excluded from the count
       (consistent with replenishment module behavior).

FR-13: The widget shows a loading skeleton while data is being fetched or recomputed.

FR-14: If the fetch fails, the widget shows an error state with a retry button.

## 6. Data Model

### replenishment_summary (table in our own DB)
| Column         | Type         | Notes                                                  |
|----------------|--------------|--------------------------------------------------------|
| id             | INT PK AI    |                                                        |
| location_id    | INT          | ActiveOne location ID                                  |
| location_name  | VARCHAR(255) | Denormalized for display                               |
| supplier_id    | INT          | ActiveOne Contact ID (type 3)                          |
| supplier_name  | VARCHAR(255) | Denormalized for display                               |
| items_to_order | INT          | Items with suggested order qty > 0 for a 7-day period  |
| computed_at    | DATETIME     | When this row was last written                         |

Unique constraint on (location_id, supplier_id).

The recompute operation truncates and re-inserts all rows atomically. Rows where
items_to_order = 0 are not written (only locations/suppliers with at least one item to order
are stored).

### Recompute logic (plain English)
For each location × supplier combination in ActiveOne:
1. For each item supplied by that supplier at that location:
   a. Compute daily_sales_rate: total units sold in the last 30 days ÷ 31, in base units
      (same conversion pipeline as the replenishment module; the purchase-unit factor cancels in
      the strict suggested-qty inequality, so the test runs in base units).
   b. Compute effective_available: on_hand + incoming PO quantities, in base units.
   c. Read supplier lead time from Contact.CUSTOM_FIELD3 (0 when null/empty).
   d. Compute suggested need: daily_sales_rate × (7 + lead_time_days) − effective_available.
   e. Flag the item as "to order" if suggested need > 0.
2. Count items-to-order per location × supplier.
3. Write only rows where items_to_order > 0 to replenishment_summary.

## 7. API Contract

### GET /replenishment/summary/api
Reads from replenishment_summary. Returns all rows ordered by location_name, then
supplier_name. No query params.

Response (200):
```json
{
  "rows": [
    {
      "locationId": "number",
      "locationName": "string",
      "supplierId": "number",
      "supplierName": "string",
      "itemsToOrder": "number",
      "computedAt": "string (ISO 8601)"
    }
  ]
}
```

Response (200, empty): `{ "rows": [] }`

### POST /replenishment/summary/api
Triggers a full recompute of the replenishment_summary table. Called by:
- The manual refresh button on the home screen widget.
- Internally by the PO submission route after a successful PO write.

No request body required.

Response (200): `{ "computedAt": "string (ISO 8601)" }`
Response (500): `{ "error": "string" }`

## 8. UI/UX Flow

### Home screen layout
- Wide screens (tablet): two-column layout. Left column: replenishment dashboard widget (taller,
  scrollable if many rows). Right column: module card grid.
- Narrow screens (phone): single column. Dashboard widget appears above the module card grid.

### Widget states

**Loading state:**
- Skeleton rows animate while the GET request is in flight.

**Items to order present:**
- Widget header: "Replenishment" with a refresh icon button (top-right).
- Last refreshed timestamp below the header: "Last updated: [time]"
- Scrollable list of rows: each row shows the supplier (under its location heading) on the left and
  a warning badge with the items-to-order count on the right. The entire row is tappable.
- Widget footer: "Plan Replenishment →" button (full-width, secondary style).

**All clear (nothing to order):**
- Green-tinted card with a check icon.
- Message: "All clear — no items need replenishment."
- Last refreshed timestamp.
- Refresh button still present.
- "Plan Replenishment →" button still present.

**Error state:**
- Error message: "Could not load replenishment status."
- "Retry" button triggers a fresh GET.

**Refresh in progress:**
- Refresh icon button shows a spinner.
- Existing rows remain visible (no full skeleton re-render).
- On success, rows update and last-refreshed timestamp updates.

### Deep-link navigation
Tapping a row navigates to:
`/replenishment?locationId={locationId}&supplierIds={supplierId}`
The replenishment module must accept these params and skip location/supplier selection.

### Post-PO submission
After PO submission succeeds, the server triggers a recompute before responding. When the user
returns to the home screen (via back navigation or the home button), the widget re-fetches
on mount and shows updated counts.

## 9. Edge Cases & Error Handling

| Scenario                                      | Expected behavior                                              |
|-----------------------------------------------|----------------------------------------------------------------|
| replenishment_summary table is empty          | Widget shows "All clear" empty state                           |
| GET /replenishment/summary/api times out      | Widget shows error state with retry button                     |
| POST recompute fails                          | Widget shows error toast; existing displayed data is preserved |
| Supplier has CUSTOM_FIELD3 = null             | Lead time treated as 0; items still counted if suggested qty > 0 over the 7-day period |
| Item daily_sales_rate = 0                     | Item excluded from the count                                   |
| Location exists in summary but is now hidden  | Row still shown (visibility filtering is a replenishment concern) |
| User taps row; location/supplier no longer valid | Replenishment module handles invalid params per its own error handling |
| Recompute triggered simultaneously (refresh + PO submit) | Last writer wins; no locking required at this scale  |

## 10. Open Questions

OQ-1: Should the widget cap how many rows it shows before a "See all" expand, or always show all
      location/supplier pairs? (Not discussed — may matter if a large store has many pairs.)

OQ-2: On the recompute, should rows with items_to_order = 0 be explicitly deleted from the
      summary table, or is a full truncate-and-reinsert always acceptable? (Assumed full
      truncate for simplicity — verify there are no read-availability concerns during the
      truncate window.)

OQ-3: What is the expected recompute duration given the full ActiveOne dataset? If it exceeds
      ~3 seconds, the POST endpoint may need to return immediately and the client should
      poll for completion.

## 11. Out of Scope / Deferred
- Push notifications, email, or SMS alerts for low stock.
- Per-user or per-supplier alert ownership.
- Configurable order period, sales window, or rounding on the widget.
- Scheduled automatic recomputes (cron job) — only manual refresh and post-PO trigger for now.
- PO list and edit module (separate planned module, unrelated to this feature).
- Visibility filtering of locations on the dashboard widget.
