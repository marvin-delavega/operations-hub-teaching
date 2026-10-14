# PRD: Replenishment Per-Piece Ordering
Date: 2026-07-05

## 1. Overview

In the Replenishment module, procurement admins currently order every line in the item's **purchase unit** (e.g. a case), with quantities rounded to whole cases. Two real situations aren't served by case-only ordering: (1) a genuine need below one case (a ~0.5-case suggestion) where the admin would rather order a handful of pieces than a full case or nothing, and (2) an item the supplier now sells **only per piece** (cases discontinued). This feature adds an **ad-hoc, per-line toggle on the Review screen** that switches a single line from cases to base pieces, recomputing its suggested quantity in pieces and writing that line to the ActiveOne PO in the base unit. It is purely a run-time decision — no admin configuration, no persisted per-item setting, no new configuration tables.

## 2. Goals

- Let an admin order any Review line in **base pieces** instead of the purchase unit, per run.
- Serve sub-case needs: a fractional-case need becomes a real, orderable piece quantity.
- Serve piece-only items: any line (even one needing multiple cases' worth) can be switched to pieces.
- Surface sub-case needs that currently vanish under round-down, so they can be reached and per-pieced.
- Keep the ActiveOne PO write correct in the base unit (unit, factor, rate, amount) for mixed-unit POs.
- Record the per-piece decision in replenishment history so it is auditable and override-highlighting stays honest.

## 3. Non-Goals

- **No admin UI or persisted per-item "sold per piece" flag.** The toggle is chosen fresh each run; it is not remembered across runs.
- No new configuration tables and no changes to `supplier_schedule`, order pooling, or selling-area mapping.
- No change to PO grouping/splitting (still one PO per supplier + manufacturer); a per-piece line simply carries a different unit within its existing PO.
- No arbitrary third unit — only the item's **base unit** is offered as the alternative to its purchase unit. No fractional quantities in either unit.
- No change to on-hand, incoming, sales-rate, DOS, or critical math (those stay in purchase units and are unaffected).
- Per-piece is **not** a special PO tag or a different submission flow — it reuses the identical Generate → Review → Submit path.

## 4. Users & Roles

- Procurement admins running a replenishment run (same users who already reach `/replenishment` and can Generate/Submit POs). No new permission is introduced; anyone who can submit a replenishment PO today can toggle a line to per-piece.
- Save/submit gates are unchanged (creator must be linked to an ActiveOne employee, etc.).

## 5. Functional Requirements

**Toggle & piece quantity (Review screen)**

- **FR-1** On the Review screen, every line exposes a **per-piece toggle** (cases ⇄ pieces) beside its existing quantity-override field. The toggle is available on **both** the Standard and Stockout paths (the shared Review step).
- **FR-2** The toggle is **hidden/disabled** for any item whose purchase unit already equals its base unit (no pack — conversion factor = 1). For those items per-piece is identical to case and would be a no-op.
- **FR-3** Switching a line to **pieces** recomputes its suggested quantity in **base units**: `suggested_pieces = ceil( daily_sales_rate_base × (order_period_days + supplier_lead_time_days) − effective_available_base )`, floored at 0. This is mathematically the unrounded purchase-unit suggestion × conversion factor, rounded up. The recompute **always rounds up**, regardless of the run's up/down rounding toggle, so a genuine need never collapses to 0 pieces.
- **FR-4** After toggling to pieces, the line's quantity field shows the recomputed piece suggestion and remains **editable** (whole positive pieces only); the admin may override it like any other line.
- **FR-5** Switching a line back to **cases** restores case-unit behavior (the case suggestion and the run's normal rounding). The unit indicator on the line reflects the current unit: purchase-unit symbol (e.g. `cs`) vs base-unit symbol (e.g. `pc`).
- **FR-6** The per-piece toggle (and its resulting piece quantity) is part of the run's **persisted draft** (localStorage, alongside existing per-item overrides), so a reload or navigating back to Review does not silently revert lines to cases.

**Main-list surfacing of sub-case needs**

- **FR-7** The main replenishment list additionally surfaces items whose **unrounded** suggested order is greater than 0 but which round to 0 cases (this only occurs under **round-down**, since round-up turns any positive need into ≥1 case). These items would otherwise be hidden by the existing `suggested_order > 0` filter. Applies symmetrically to Standard and Stockout (both reuse the run's rounding toggle).
- **FR-8** A surfaced sub-case item displays a distinct **"<1 cs"** marker/badge in its suggested-order cell instead of a numeric quantity, signaling a genuine below-one-case need to consider per-piece.
- **FR-9** Surfaced sub-case items default to **unchecked** (opt-in), so an ordinary run is not padded with marginal piece orders. All other rows keep their existing default-checked behavior. Sub-case rows still obey the existing DOS-ascending sort within their manufacturer sub-group.
- **FR-10** A sub-case line left in cases carries a rounded quantity of 0; on Generate/Submit, zero-quantity lines are excluded (existing behavior). To be ordered it must be per-pieced on Review (or manually given a case quantity).

**PO write-back (ActiveOne)**

- **FR-11** For a line ordered in **pieces**, the ActiveOne `purchase_order_items` row is written with `UNIT_ID = item.BASE_UNIT_ID`, `UNIT_BASE_QUANTITY = 1`, `QUANTITY` = the piece count, `RATE = item.COST` (per base unit), and `AMOUNT = QUANTITY × RATE`. Case lines are written exactly as today (`UNIT_ID = PURCHASES_UNIT_ID`, `UNIT_BASE_QUANTITY = factor`, `RATE = COST × factor`).
- **FR-12** A single ActiveOne `purchase_order` may contain a mix of case-unit and piece-unit lines. Supplier + manufacturer grouping is unchanged; per-piece only changes a line's unit fields, never which PO it lands in.
- **FR-13** The server is the source of truth for unit/factor/rate: it derives `BASE_UNIT_ID`, `PURCHASES_UNIT_ID`, factor, and cost from the item's DB record. The client sends only a per-line **per-piece flag** and the quantity; the server never trusts a client-sent unit or factor.

**History snapshot**

- **FR-14** A per-piece line is recorded in `replenishment_run_line` with its **suggested_qty and final_qty in pieces**, `unit_symbol` = the base-unit symbol, and a new **per-piece indicator** flag set true, so override highlighting compares piece-to-piece and the deliberate unit switch is visible in Delivery/Replenishment history.
- **FR-15** Case lines record unchanged (case suggestion/final, purchase-unit symbol, indicator false).

## 6. Data Model

No new tables. One additive column, applied via the existing idempotent `ALTER` pattern in `scripts/create-app-tables.sql`.

**`replenishment_run_line` (existing, one added column)**

| Field | Type | Notes |
|---|---|---|
| `ordered_per_piece` | tinyint(1) NOT NULL default 0 | New. True when this line was ordered in base pieces via the Review toggle. |
| `unit_symbol` | varchar(50) | Existing. Base-unit symbol when `ordered_per_piece`, else purchase-unit symbol. |
| `suggested_qty` | int | Existing. In pieces when `ordered_per_piece`, else in cases. |
| `final_qty` | int | Existing. In pieces when `ordered_per_piece`, else in cases. |

**Read-side enrichment (no schema change)** — the replenishment read query is extended to also return, per item, the **base-unit symbol** and the **conversion factor** (base pieces per purchase unit) alongside the existing purchase-unit symbol, so the Review screen can toggle and recompute a piece suggestion with **no extra server round-trip**.

**Transient (client) state** — per line during a run: `orderedPerPiece: boolean` plus the piece quantity, persisted in the run's localStorage draft with the other per-item overrides.

## 7. API Contract

Reuses existing endpoints; only payload shapes widen.

**Read — replenishment groups / stockout candidates (GET, existing)**
- Response: each item additionally includes `baseUnitSymbol` and `conversionFactor` (base per purchase unit). Existing `unitSymbol` remains the purchase-unit symbol. Sub-case items (unrounded suggestion > 0, rounds to 0 under round-down) are included with a flag/marker distinguishing them so the UI can render "<1 cs" and default them unchecked.

**Submit PO (POST `/replenishment/po`, existing)**
- Request: each submitted line gains an optional `orderedPerPiece: boolean` (default false). Quantity is interpreted in the line's chosen unit (pieces when the flag is true, else purchase units).
- Server behavior: for `orderedPerPiece` lines, resolve base unit/factor/cost from the item record and write the ActiveOne line and the `replenishment_run_line` snapshot per FR-11 and FR-14. Existing validations (unknown SKU rejection, creator-linked-employee gate, atomic all-or-nothing rollback) are unchanged.
- Response: unchanged shape (per-PO results grouped by supplier → manufacturer).

## 8. UI/UX Flow

1. **Main list** — In a round-down run, items with a genuine sub-case need now appear with a **"<1 cs"** badge in the suggested-order column and are **unchecked** by default. The admin checks the ones worth ordering. Round-up runs and above-one-case items are unaffected.
2. **Generate PO** — Selected lines (including checked sub-case lines, still at 0 cases) carry to Review.
3. **Review screen** — Each line shows its unit and an editable quantity. Beside the quantity is the **per-piece toggle** (cases ⇄ pieces), shown only when the item has a real pack (factor > 1).
   - Toggling **to pieces**: unit indicator switches to the base symbol (e.g. `pc`); quantity is replaced by the recomputed **rounded-up piece suggestion**; the admin can adjust it. A sub-case line that read 0 cases now shows a positive piece figure.
   - Toggling **back to cases**: restores the case quantity/unit and the run's rounding.
   - The chosen state survives reload/back-navigation (persisted draft).
4. **Submit PO** — Atomic per supplier + manufacturer as today. Piece lines are written to ActiveOne in the base unit; a PO may mix case and piece lines.
5. **Success summary** — Unchanged (grouped by supplier, one row per manufacturer PO).
6. **History** — The run detail shows per-piece lines in pieces with the base unit and a distinct **"ordered per piece"** indicator; system-suggested vs final qty compare piece-to-piece.

## 9. Edge Cases & Error Handling

- **Factor = 1 (purchase unit is base):** toggle hidden/disabled (FR-2); the item behaves exactly as today.
- **Piece suggestion still small:** always-round-up (FR-3) guarantees a positive orderable figure when there is any genuine need; a zeroed need stays 0.
- **Sub-case line left in cases (0 qty):** excluded on submit like any zero line (FR-10) — no empty PO line is written.
- **Admin manually zeroes a per-piece line:** treated as a zero line and excluded on submit.
- **Mixed-unit PO rejected by ActiveOne:** must be ruled out before trusting the write — a **verification against real ActiveOne data** that one `purchase_order` can hold both case-unit and piece-unit lines is a precondition of shipping (see Open Questions / past experience of app "constants" being wrong).
- **Stale/tampered payload (unknown SKU, unlinked creator):** existing rejections and atomic rollback apply unchanged; the per-piece flag does not bypass them.
- **Client sends per-piece flag but item has no base unit / factor unresolved:** server treats it as case (or rejects) rather than writing a malformed unit — never write a NULL/incoherent unit to ActiveOne.

## 10. Open Questions

- **ActiveOne mixed-unit PO validity** — confirm with real ActiveOne data (and, if possible, ActiveOne's own PO screen) that a single PO containing both case-unit and piece-unit lines is valid and displays/bills correctly before the write path is trusted. (Accepted as a build precondition.)
- **Base-unit symbol source** — confirm the base unit always resolves to a `unit_of_measure.SYMBOL` (e.g. `pc`) for display; define the fallback label if a base unit has no symbol row.

## 11. Out of Scope / Deferred

- Persistent per-item "sold only per piece" configuration and any admin UI for it (explicitly rejected — ad-hoc only).
- Per-piece toggle on the main list (Review-only by decision).
- Any unit other than the item's base unit; fractional quantities; per-supplier unit rules.
- Bulk "convert all sub-case lines to pieces" action.
- Changes to sales-rate/DOS/critical/incoming computations.
