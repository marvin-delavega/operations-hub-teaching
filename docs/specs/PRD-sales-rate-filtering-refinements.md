# PRD: Sales Rate — Filtering & Available Stock Refinements
Date: 2026-06-17

## 1. Overview
This PRD refines the sales-rate replenishment screen design based on how the purchasing team actually works. It replaces the DOS-threshold filter with a suggested-order-based filter, introduces per-supplier order period controls, and incorporates incoming stock from open POs into the available stock calculation so already-ordered items do not resurface.

## 2. Goals
- Surface only items that genuinely need ordering for the selected period
- Prevent items already covered by open POs from appearing in the list
- Allow per-supplier order period selection to accommodate varying lead times and stocking strategies
- Simplify the header controls by removing the DOS threshold field

## 3. Non-Goals
- Does not change the PO generation or review flow
- Does not manage or display open POs (that is a separate planned module)
- Does not filter per-item — filtering is per-supplier-group based on the supplier's selected order period

## 4. Users & Roles
Purchasing department staff reviewing items to replenish. No role restriction beyond the existing staff/admin auth.

## 5. Functional Requirements

FR-1. An item appears in the list only if its suggested order quantity (for its supplier's selected order period) is greater than 0.

FR-2. Available stock used in all calculations is: on-hand stock + sum of undelivered quantity from all open POs in ActiveOne for that item (regardless of PO origin).

FR-3. A PO is considered "open" if its status value is 0. (To be verified against live ActiveOne data before implementation.)

FR-4. The suggested order formula is:
      max(0, ceil_or_floor(daily_rate × (order_period + lead_time) − (on_hand + incoming)))

FR-5. Each supplier group header includes its own order period selector (options: 7 / 14 / 30 days).

FR-6. The global order period control in the page header sets the default for all supplier group selectors when changed.

FR-7. Changing a supplier group's order period immediately re-filters and re-calculates quantities for that group. Items may appear or disappear as a result.

FR-8. The DOS threshold header control is removed entirely.

FR-9. DOS remains a display-only column on each item row (for reference), and items with DOS < lead_time are still flagged critical.

FR-10. Header controls are: date range · global order period · rounding toggle.

## 6. Data Model
No schema changes. Two values are computed at query time per item:
- on_hand: current stock from ActiveOne inventory
- incoming: sum of open PO line quantities for that item (PO status = 0)
- effective_available: on_hand + incoming
- suggested_order: max(0, ceil_or_floor(daily_rate × (order_period + lead_time) − effective_available))

## 7. API Contract
Existing /sales-rate/api GET endpoint.

Additional input: no new fields — order_period is already a parameter.
The response per item gains one new field: incoming (integer, units).

The server applies the suggested_order > 0 filter after computing effective_available, so the client receives only items that need ordering.

## 8. UI/UX Flow
1. User opens the sales rate screen.
2. Header shows: date range · order period (global default) · rounding.
3. Items load grouped by supplier, filtered to suggested order > 0.
4. Each supplier group header shows: supplier name · item count · critical count badge · order period selector (defaults to global).
5. User may change a supplier's order period — that group immediately re-filters and recalculates.
6. User reviews items, unchecks exclusions, taps Generate PO.
7. Review and submission flow unchanged.

## 9. Edge Cases & Error Handling
- If incoming stock alone covers the period, suggested order = 0 and the item does not appear. No special message needed — absence is correct.
- If all items for a supplier are covered, the supplier group is hidden entirely.
- If daily_rate = 0, item is excluded (existing rule, unchanged).
- If ActiveOne returns no open PO data, incoming defaults to 0 and the calculation proceeds with on-hand only.

## 10. Open Questions
- OQ-1: Confirm which ActiveOne PO status value(s) map to "open / undelivered". Currently assumed to be 0 — must be verified against live data before implementation.
- OQ-2: Does "undelivered quantity" mean the full PO line quantity, or (ordered − received) for partially fulfilled POs?

## 11. Out of Scope / Deferred
- PO list and edit module (separate planned module)
- Per-item order period override on the review screen (superseded by per-supplier selector on the main screen)
- Offline support
