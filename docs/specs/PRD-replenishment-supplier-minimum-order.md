# PRD: Per-Supplier Minimum Order (Replenishment)
Date: 2026-07-08

## 1. Overview
Suppliers often impose a minimum order (a peso value and/or a unit count) below which they will not accept or ship a purchase order. Today a replenishment run can generate a PO that falls below a supplier's minimum with no signal. This feature lets admins record an optional **₱ minimum** and/or an optional **quantity minimum** per supplier, shows a **live indicator** on the supplier header as an order is built, and **warns (non-blocking)** at Submit when a supplier's order falls short. It applies to the **Standard** replenishment path only.

## 2. Goals
- Let admins configure, per supplier, an optional minimum peso value and an optional minimum quantity.
- Surface a live "running total / minimum" indicator on every supplier header (main run list **and** Review) once a minimum is set.
- Warn the user before submitting when any supplier's order is below its configured minimum, while still allowing them to proceed.
- Compute the comparison against the **per-supplier total** (summed across that supplier's manufacturer-split POs).
- Record, in the immutable run history, when a user acknowledged a below-minimum warning and the thresholds in effect at submit time.
- Introduce no ActiveOne schema changes; store all new state on the app-owned `supplier_schedule` table.

## 3. Non-Goals
- **Not** a hard block. Submission is never prevented by a below-minimum order.
- **No** server-side rejection of below-minimum POs (the check is advisory only).
- **No** per-location minimums — the minimum is global to the supplier.
- **No** minimum enforcement on the **Stockout** path.
- **No** maximum-order or reorder-multiple/pack-size rounding logic (out of scope).
- **No** change to how POs are split (still by supplier + manufacturer) or written to ActiveOne.

## 4. Users & Roles
- **Admins with the Order Scheduling tab permission** — configure supplier minimums (same permission that governs the existing Order Scheduling Kanban). No new permission is introduced.
- **Any user running a Standard replenishment run** — sees the live indicator and the below-minimum warning at Submit. The warning gates nothing; all roles that can submit a run today can still submit.

## 5. Functional Requirements

### Configuration (Admin → Order Scheduling)
- **FR-1** Each supplier card in the Order Scheduling Kanban exposes a "Set minimum" affordance (icon/link) that opens a **dialog** with two optional fields: **Minimum ₱ value** and **Minimum quantity**.
- **FR-2** Both fields are optional and independent. A supplier may have neither, one, or both set. A blank field clears (unsets) that minimum.
- **FR-3** The ₱ minimum accepts a non-negative number with up to 2 decimal places. The quantity minimum accepts a non-negative whole number. Invalid input is rejected at the save endpoint (fail-fast) with a field-level message.
- **FR-4** Saving a minimum for a supplier that has no `supplier_schedule` row creates one (`schedule_type = 'lead_time'`, schedule fields null). Setting a minimum **never** changes the supplier's due/schedule status — a supplier with a minimum but no weekly/monthly schedule and no lead time remains **unscheduled**.
- **FR-5** Minimums are global to the supplier: they apply to every location's run for that supplier.

### Live indicator (Standard run — main list + Review)
- **FR-6** For each supplier that has **at least one** minimum configured, the supplier header shows a live indicator of the **current order total vs. the minimum**, for each configured metric. Format: `₱{running} / ₱{min} min` and/or `{running} / {min} units min`.
- **FR-7** If a supplier has **no** minimum configured, no indicator is shown for that supplier.
- **FR-8** The running total reflects **only the currently selected (checked) lines** for that supplier and updates live as lines are checked/unchecked and quantities are adjusted.
- **FR-9** The **₱ running total** is the pre-tax goods subtotal: for each selected line, `orderQty (in its written unit) × unit cost`, summed across the supplier's lines. It uses the same `item.COST × factor` basis the PO writer uses for case lines and `item.COST` for per-piece split lines, so the figure matches the PO's pre-tax line amounts. Tax is excluded.
- **FR-10** The **quantity running total** is a crude sum of each selected line's order quantity **in its written purchase unit** (a case counts as 1, a pack counts as 1; a per-piece split line's remainder pieces count individually).
- **FR-11** When a metric's running total is **below** its minimum, that indicator renders in the `warning` status token; when met or exceeded it renders neutral.
- **FR-12** The indicator respects the Review screen's per-line adjustments (qty overrides and the per-piece cases⇄pieces toggle) — the Review indicator reflects the final quantities that will be submitted.

### Warning at Submit (Standard run — Review screen)
- **FR-13** On Submit, if **any** supplier's order is below **either** of its configured minimums, a single **confirm dialog** appears listing each below-minimum supplier and, per failing metric, its shortfall (e.g. "Acme Foods — ₱4,200 of ₱5,000; 8 of 10 units").
- **FR-14** A supplier is "below minimum" if it fails the ₱ minimum **or** the quantity minimum (either shortfall triggers the warning; both are listed if both fail).
- **FR-15** The confirm dialog offers **Submit anyway** (proceeds with the normal submission) and **Cancel** (returns to Review to adjust). The check is advisory: proceeding submits the POs unchanged.
- **FR-16** If no supplier is below minimum, Submit proceeds directly with no extra dialog.

### History / audit
- **FR-17** When a run is submitted after the user acknowledged a below-minimum warning, the replenishment run history snapshot records, at run level: that the below-minimum warning was **acknowledged**, and the set of below-minimum suppliers with their **thresholds and running totals at submit time** (per metric). Runs submitted with no below-minimum suppliers record no such flag (or record it as false/empty).

### Scope guard
- **FR-18** None of the above applies to the **Stockout** path: no indicator, no warning, no history override flag.

## 6. Data Model

New columns on the app-owned **`supplier_schedule`** table (added via the existing idempotent ALTER pattern in `create-app-tables.sql`; no ActiveOne changes):

| Column | Type | Notes |
|---|---|---|
| `min_order_value` | decimal, nullable | Minimum pre-tax peso value for the supplier's order. `NULL` = unset. Non-negative. |
| `min_order_quantity` | integer, nullable | Minimum crude purchase-unit count. `NULL` = unset. Non-negative. |

- Both nullable and independent; either, both, or neither may be set.
- No new table. No per-location dimension (keyed by existing `supplier_id` PK).
- Read pipeline addition: the enriched replenishment read query must surface each item's **unit cost** (and the resolved conversion factor already present) so the ₱ running total can be computed client-side without per-item round-trips.

## 7. API Contract

### Admin — save supplier minimum (extends existing Order Scheduling update)
- **Endpoint/method:** the existing supplier-schedule update path (`/admin/...` POST/PUT used by the Order Scheduling Kanban), extended to carry the two minimum fields — **or** a sibling handler in the same admin API. No new business logic beyond persistence + validation.
- **Request (per supplier):** `{ supplierId, minOrderValue: number | null, minOrderQuantity: number | null, ... existing schedule fields }`.
- **Validation:** `minOrderValue` ≥ 0, ≤ 2 decimals, or null; `minOrderQuantity` integer ≥ 0, or null. Reject invalid with a 4xx and a field message.
- **Response:** minimal confirmation (existing shape).

### Replenishment read (Standard) — enriched with cost + minimums
- **Endpoint/method:** existing Standard replenishment GET (`/replenishment/api` / summary read).
- **Response additions:**
  - Per **supplier group**: `minOrderValue: number | null`, `minOrderQuantity: number | null`.
  - Per **item**: `unitCost` (per base unit) so the client can compute pre-tax line ₱ totals with the already-provided `conversionFactor` and order quantity.

### Replenishment submit (PO creation) — history override payload
- **Endpoint/method:** existing PO submit (`/replenishment/po` POST). Unchanged behavior; **no rejection added**.
- **Request additions (optional):** a below-minimum acknowledgment block — the list of below-minimum suppliers with `{ supplierId, minOrderValue, minOrderQuantity, runningValue, runningQuantity }` captured at submit time — persisted into the run history snapshot inside the same atomic transaction.

## 8. UI/UX Flow

### Admin configuration
1. Admin opens **/admin → Order Scheduling**.
2. On a supplier card, taps **Set minimum**.
3. Dialog opens with **Minimum ₱ value** and **Minimum quantity** (pre-filled if set). Admin enters one or both, or clears a field.
4. Saves → validated → persisted to `supplier_schedule`. Card reflects that a minimum is set (e.g. a small badge/indicator).

### Standard run — building the order (main list)
1. User runs a Standard replenishment run (location → suppliers → screen).
2. Each supplier header with a configured minimum shows the live indicator (`₱ running / ₱ min`, `qty running / qty min`).
3. As the user checks/unchecks items and edits quantities, the running totals update live. A metric below its minimum shows in the `warning` token.

### Standard run — Review + Submit
1. User taps **Generate PO** → Review screen (supplier → manufacturer).
2. Supplier sections show the same live indicator, reflecting per-item overrides and per-piece toggles.
3. User taps **Submit PO**.
4. If any supplier is below minimum → confirm dialog lists each below-minimum supplier and its shortfall(s), with **Submit anyway** / **Cancel**.
5. **Cancel** → back to Review to adjust. **Submit anyway** (or no below-minimum suppliers) → normal atomic submission; the acknowledgment (if any) is recorded in run history; success summary shows as today.

## 9. Edge Cases & Error Handling
- **No minimum configured:** no indicator, no warning for that supplier (FR-7).
- **Minimum set to 0:** treated as configured; any non-empty order meets it (indicator shows, always "met"). Distinct from unset (`NULL`).
- **Supplier fully unchecked (no selected lines):** contributes no PO; it is not evaluated for the warning (there is no order to fall short).
- **Unscheduled supplier with a minimum:** minimum still applies on any run that includes it; setting the minimum does not make it "scheduled."
- **Both minimums set, one met one not:** supplier is below minimum; the warning lists only the failing metric(s) (FR-14).
- **Per-piece split lines:** ₱ uses `pieceQty × cost`; qty counts remainder pieces individually toward the crude qty sum (FR-9, FR-10).
- **Missing/zero item cost in ActiveOne:** the line contributes ₱0 to the running total; the indicator may under-report. Acceptable (advisory); no error raised.
- **Invalid admin input (negative, >2 decimals on ₱, non-integer qty):** rejected at save with a field message; nothing persisted.
- **Tampered/scripted submit skipping the client warning:** submission still succeeds (by design — advisory, not a gate). Nothing to protect.
- **Currency/number formatting:** ₱ shown with thousands separators; quantities as whole numbers.

## 10. Open Questions
- None blocking. (Confirm the exact visual placement/style of the "minimum set" badge on the Kanban card and the indicator's typographic slot on the supplier header against DESIGN.md during implementation — a styling detail, not a design decision.)

## 11. Out of Scope / Deferred
- Per-location supplier minimums.
- Minimum enforcement on the Stockout path.
- Hard-blocking submission below minimum (and any server-side rejection).
- Maximum-order limits, reorder multiples, or pack-size rounding.
- Auto-suggesting quantities to reach the minimum ("top up to minimum").
- Surfacing minimums or shortfalls in the supplier selection screen or the home due-today badge.
