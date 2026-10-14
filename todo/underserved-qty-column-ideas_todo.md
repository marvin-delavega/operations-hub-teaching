# Underserved Quantity Column — Feature Ideas

Captured 2026-08-03. Not yet scoped — warrants a PRD before implementation.

Context: the replenishment module's Standard and Stockout paths surface
suggested order quantities based on current stock levels, daily sales rates,
and lead times — but a buyer also needs to know whether the *last* delivery
for an item was short. A display-only "Underserved" column shows what was
ordered on the most recent PO vs what was actually entered through Enter Bill,
giving the buyer a heads-up without altering the suggestion formula.

## Tier 1 — Highest value

- [ ] **Underserved quantity column (replenishment list)**
      Add a new column "Underserved" to the Standard replenishment list
      (between "Incoming" and "Total Stock") and to the Review screen. Per
      item, query the **most recent ActiveOne PO line** (within the last 30
      days) that has been through Enter Bill (`RECEIVED_QTY > 0`) and show
      `ORDERED_QTY - RECEIVED_QTY` in purchase units. Items with no qualifying
      PO or zero underserved show `—`. Display-only — the suggestion formula
      is unchanged.

## Data source & query strategy

- **Source:** ActiveOne `purchase_order` + `purchase_order_items` directly
  (not our `delivery_line` snapshot). Enter Bill drives `RECEIVED_QTY`.
- **Scope:** POs dated within the **last 30 days** from today, any status.
  Only lines where `RECEIVED_QTY > 0` qualify (Enter Bill has run).
- **Item match:** join on `ITEM_ID`, factoring in the item's
  `unit_of_measure` conversion (ordered/received in purchase units, not base).
- **"Most recent"** = the PO with the latest `purchase_order.DATE` that
  includes the item. If multiple POs in the window, only the newest one
  contributes.
- **Conversion:** `ORDERED_QTY` and `RECEIVED_QTY` from
  `purchase_order_items` are already in the PO's purchase unit — but may need
  a factor check if the PO used a different unit than the item's current
  `PURCHASES_UNIT_ID`. Simplest path: divide by the current conversion factor
  so the display unit matches the rest of the replenishment columns.
- **Performance:** resolve in one enrichment query (not per-item N+1). The
  `GetReplenishmentGroups` query can LEFT JOIN a window-function subquery
  (`ROW_NUMBER() PARTITION BY item_id ORDER BY po.DATE DESC`) to pick the
  most recent qualifying line.

## Edge cases to address

- **Superseding PO chain:** our delivery module creates a new PO and closes
  the original. The new PO's `ORDERED_QTY` = our received qty; after Enter
  Bill the new PO should show `underserved = 0` (exact match). The original
  PO, closed with `RECEIVED_QTY = 0`, will show as fully underserved — this
  is an acceptable artifact of relying on ActiveOne data alone, since the
  replacement PO already reflects the actual delivery.
- **Item not on any PO in the window:** show `—`.
- **PO line with `RECEIVED_QTY = 0` (Enter Bill not yet run):** skip — we
  don't know the actual received amount yet.
- **PO line with `RECEIVED_QTY > ORDERED_QTY` (over-delivery):** show `0`,
  not a negative number. Underserved is a floor, not a net.

## Tier 2 — Strong, moderate effort

- [ ] **Hover/tooltip showing the PO reference**
      Expand the "Underserved" cell with a tooltip showing "PO #OHPO-001234:
      ordered 50, received 30" — gives the buyer context without leaving the
      replenishment list.

- [ ] **Critical underserved badge**
      If underserved > some threshold (e.g., > 20% of the current suggestion
      or > the daily rate × lead time), flag with a `warning` badge to
      highlight items at risk of repeating the shortfall.

## Tier 3 — Convenience / workflow

- [ ] **Extend underserved column to Stockout tab**
      Stockout items are already stocked out (effective available = 0), so
      the concept is less relevant — but a "Last PO received less than
      ordered?" signal could still be useful during review.

- [ ] **Underserved trend (history view)**
      In the replenishment history detail, show the underserved value at the
      time the run was generated, for audit/comparison.

## Suggested starting point

Add the core column to Standard replenishment only. It's a single LEFT JOIN
subquery in the `GetReplenishmentGroups` SQL and one new column in the
`ReplenishmentItem` interface + UI — low risk, high value for buyer
confidence.
