# Replenishment Module — Feature Ideas

Candidate enhancements for the `replenishment` module, ordered by value.
Captured 2026-07-08. Not yet scoped — each Tier 1/2 item likely warrants its
own PRD (`/brainstorm`) before implementation.

Context: the module already covers Standard + Stockout paths, DOS/critical
flagging, unit conversion, per-piece ordering, selling-area demand pooling,
the `item_sales_daily` off-take rollup, supplier scheduling, and PO split by
supplier + manufacturer. These ideas close the loop between *"here's the
suggestion"* and *"here's a confident purchase decision."*

## Tier 1 — Highest value

- [ ] **Supplier order guardrails (MOQ / minimum order value)**
      Per-supplier minimum order quantity or ₱ value. Store on
      `supplier_schedule`; show a live "₱X / ₱Y minimum" indicator on the
      supplier header and warn before Submit when a PO falls below minimum.
      Rationale: a run can currently generate a PO below a supplier's minimum.

- [ ] **Estimated PO cost / spend visibility**
      Surface the `RATE`/`COST` already resolved for write-back as running
      totals per manufacturer PO, per supplier, and a grand total for the run.
      Feeds directly into the MOQ guardrail above.

- [ ] **Incoming-PO detail (not just the netted number)**
      `effective_available` already folds in `incoming` but it's invisible.
      Add a hover/expand showing which open POs contribute + expected arrival,
      to prevent double-ordering. Data is already queried.

- [ ] **Lost-demand correction for stockouts**
      Daily rate currently divides by the full calendar span, so stockout days
      drag the rate down and systematically under-order items that stock out
      most. Option: divide by in-stock days only, or flag items whose sales
      window overlaps a zero-on-hand period.

## Tier 2 — Strong, moderate effort

- [ ] **Safety-stock / service-level buffer**
      Add a configurable buffer (flat days or %) to the suggestion formula
      `max(0, ceil/floor(rate × (period + lead_time) − available))` so critical
      suppliers carry a cushion.

- [ ] **Lead-time reliability from history**
      `CUSTOM_FIELD3` is a static promise. Compute actual PO→bill lead time
      from history and flag suppliers who chronically run late so critical
      thresholds reflect reality.

- [ ] **Overstock / dead-stock companion view**
      Inverse report: very high DOS or zero-sales items sitting on hand.
      Reuses the rollup + DOS math; drives transfers/returns instead of orders.

## Tier 3 — Convenience / workflow

- [ ] **Save & resume a run**
      Persist an in-progress run server-side (already drafts to localStorage)
      so a buyer can pause and a supervisor can review before submit.

- [ ] **Due-today / critical notifications**
      The home badge already counts suppliers due; add a proactive alert (or
      have the nightly rollup job emit a summary).

- [ ] **"Show all items" toggle (Standard only)**
      A toggleable setting in a new **Ordering** admin tab that makes the
      Standard replenishment run display every item for the selected
      suppliers, not just those with `rawNeed > 0`. Items with
      `suggestedQty == 0` appear grayed out/unchecked so the buyer can see
      what would *not* be ordered and optionally override the quantity to
      place a manual order. Does not affect the Stockout tab. New setting
      stored in `app_settings` (e.g. `ordering_show_zero_qty_items`); new
      `admin.ordering` permission gates the tab.

## Suggested starting point

Start with **MOQ guardrails + cost visibility** together — they share the
supplier/manufacturer header UI surface and reuse already-fetched data, giving
the most decision-confidence per unit of work. If suggestion *accuracy* is the
priority instead, **lost-demand correction** is the highest-value fix.
