# Implementation Plan: Per-Supplier Minimum Order (Replenishment)
Source PRD: [PRD-replenishment-supplier-minimum-order.md](PRD-replenishment-supplier-minimum-order.md)
Date: 2026-07-08

## Summary
Add an optional per-supplier **₱ minimum** and **quantity minimum**, stored on the app-owned `supplier_schedule` table, configured from the Admin → Order Scheduling Kanban. During a **Standard** replenishment run, surface a live running-total-vs-minimum indicator on each supplier header (main list + Review), warn (non-blocking) at Submit when any supplier is below either minimum, and record the acknowledgment + thresholds in the immutable run-history snapshot. The Stockout path is untouched. No ActiveOne schema changes; no server-side gate.

## Affected Areas

### DB — [scripts/create-app-tables.sql](../../scripts/create-app-tables.sql)
- **`supplier_schedule`**: add `min_order_value` (decimal(18,2) NULL) and `min_order_quantity` (int NULL) via the existing idempotent `information_schema.COLUMNS` ALTER pattern (mirror the `created_by_employee_code` / `item_code` blocks at lines 320–405).
- **`replenishment_run`**: add `below_min_acknowledged` (tinyint(1) NOT NULL DEFAULT 0) and `below_min_details` (JSON/longtext NULL) via the same idempotent pattern — persists FR-17 at run level.

### Shared — supplier schedule (used by admin + replenishment + supplier + landing badge)
- [app/shared/domain/supplierSchedule.ts](../../app/shared/domain/supplierSchedule.ts) — extend `SupplierScheduleData` with `minOrderValue: number | null` and `minOrderQuantity: number | null`. `isUnscheduled`/due math **must not** consider minimums (FR-4/FR-33 — a minimum never changes schedule status).
- [app/shared/domain/SupplierScheduleRepository.ts](../../app/shared/domain/SupplierScheduleRepository.ts) — add `setMinimums(supplierId, minOrderValue, minOrderQuantity): Promise<void>` to the port.
- [app/shared/infrastructure/MySQLSupplierScheduleRepository.ts](../../app/shared/infrastructure/MySQLSupplierScheduleRepository.ts) — select the two new columns in `DATA_SQL`; map them in `getData`; implement `setMinimums` (upsert touching only the min columns, creating a `lead_time` row when absent — FR-4).

### Admin — Order Scheduling minimum config
- New use case [app/(authenticated)/admin/application/SetSupplierMinimumUseCase.ts](../../app/(authenticated)/admin/application/SetSupplierMinimumUseCase.ts).
- New route [app/(authenticated)/admin/order-scheduling/minimums/api/route.ts](../../app/(authenticated)/admin/order-scheduling/minimums/api/route.ts) (PUT) — validation + persistence only.
- [app/(authenticated)/admin/OrderSchedulingKanban.tsx](../../app/(authenticated)/admin/OrderSchedulingKanban.tsx) — "Set minimum" affordance + dialog + "minimum set" badge on the card.
- [container.ts](../../container.ts) — add `createSetSupplierMinimumUseCase()`.

### Replenishment — read enrichment
- [app/(authenticated)/replenishment/domain/ReplenishmentItem.ts](../../app/(authenticated)/replenishment/domain/ReplenishmentItem.ts) — add `unitCost: number` (per base unit) to `ReplenishmentItem`; add `minOrderValue`/`minOrderQuantity` to `SupplierGroup`.
- [app/(authenticated)/replenishment/infrastructure/MySQLReplenishmentRepository.ts](../../app/(authenticated)/replenishment/infrastructure/MySQLReplenishmentRepository.ts) — select `si.COST` (add `COST` to the `supplier_items` CTE), map to `unitCost`.
- [app/(authenticated)/replenishment/infrastructure/SeedReplenishmentRepository.ts](../../app/(authenticated)/replenishment/infrastructure/SeedReplenishmentRepository.ts) — mirror `unitCost` so the seed path keeps parity.
- [app/(authenticated)/replenishment/api/route.ts](../../app/(authenticated)/replenishment/api/route.ts) — attach `minOrderValue`/`minOrderQuantity` per supplier group (from `SupplierScheduleData`, alongside the existing `dueStatus` enrichment).

### Replenishment — UI + submit
- [app/(authenticated)/replenishment/page.tsx](../../app/(authenticated)/replenishment/page.tsx) — supplier-minimums map; live indicator on the Standard supplier headers (main + Review); below-minimum confirm dialog in `handleSubmitPO`; carry `unitCost` on `POLineState`; add ack block to the submit payload. **Stockout branch unchanged.**
- [app/(authenticated)/replenishment/domain/PurchaseOrder.ts](../../app/(authenticated)/replenishment/domain/PurchaseOrder.ts) — add optional `belowMinAck` to `PurchaseOrder`.
- [app/(authenticated)/replenishment/api/po/route.ts](../../app/(authenticated)/replenishment/api/po/route.ts) — pass `belowMinAck` through (no rejection — advisory only).
- [app/(authenticated)/replenishment/infrastructure/MySQLPurchaseOrderRepository.ts](../../app/(authenticated)/replenishment/infrastructure/MySQLPurchaseOrderRepository.ts) — write `below_min_acknowledged`/`below_min_details` on the **standard** `replenishment_run` INSERT only.

## Decisions
- **Resolved by AI — dedicated minimum-config endpoint + use case** (not folding minimums into the existing `UpdateSupplierScheduleUseCase` PUT). The PRD explicitly permits "a sibling handler in the same admin API." SRP (CLAUDE.md): schedule PUT owns schedule fields; a `setMinimums` upsert touches only the two min columns, so the "Set minimum" dialog can't clobber a supplier's weekday/month-day. FR-4's "create a `lead_time` row if absent" lives in the repo upsert.
- **Resolved by AI — surface `unitCost` in the enriched read query** (add `it.COST` to the `supplier_items` CTE) rather than a per-item round-trip. Directly required by FR-9/§6/§7 and matches the "single enriched SQL query, no per-item round-trips" rule.
- **Resolved by AI — FR-17 stored as two run-level columns** (`below_min_acknowledged` + `below_min_details` JSON) on `replenishment_run`, not a child table. It is run-level data, written once inside the existing PO transaction; JSON holds the variable-length supplier list `[{supplierId, minOrderValue, minOrderQuantity, runningValue, runningQuantity}]`. Only the **standard** run row carries it (FR-18).
- **Resolved by AI — ₱ running total uses `unitCost × conversionFactor` for case lines and `unitCost` for per-piece lines**, matching `expandOrderLine`'s RATE basis (FR-9), so the indicator equals the PO's pre-tax line amounts.
- **Resolved by AI — quantity running total is the crude written-purchase-unit sum** (case = 1, pack = 1, each remainder piece of a split line = 1), per FR-10 / edge case in §9.
- **Assumptions:**
  - `min_order_value` typed `decimal(18,2)` (2-decimal ₱, consistent with money handling); `min_order_quantity` typed `int`.
  - Minimum of `0` is "configured and always met" and stored as `0`, distinct from `NULL`/unset (FR-10 edge case).
  - History-viewer display of the below-minimum flag is **not** built here — the PRD requires only that it be recorded; surfacing it belongs to the History module. (`replenishment_run` detail reads pick up the new columns for free if later wanted.)
  - The indicator's exact typographic slot and the card badge style are settled against `DESIGN.md` at build time (PRD §10 — styling detail, uses the `warning` token for below-minimum).

## Implementation Steps

1. **DB schema** — [scripts/create-app-tables.sql](../../scripts/create-app-tables.sql). Add idempotent ALTER blocks for `supplier_schedule.min_order_value`, `supplier_schedule.min_order_quantity`, `replenishment_run.below_min_acknowledged`, `replenishment_run.below_min_details`. Copy the exact `SET @… := (SELECT COUNT(*) FROM information_schema.COLUMNS …)` / `PREPARE`/`EXECUTE`/`DEALLOCATE` shape used for `item_code` (lines 379–391).

2. **Shared domain** — [supplierSchedule.ts](../../app/shared/domain/supplierSchedule.ts): add `minOrderValue`/`minOrderQuantity` to `SupplierScheduleData`. Confirm `isUnscheduled`/`resolveDueInfo` ignore them.

3. **Shared repo port** — [SupplierScheduleRepository.ts](../../app/shared/domain/SupplierScheduleRepository.ts): add `setMinimums(supplierId: number, minOrderValue: number | null, minOrderQuantity: number | null): Promise<void>`.

4. **Shared repo impl** — [MySQLSupplierScheduleRepository.ts](../../app/shared/infrastructure/MySQLSupplierScheduleRepository.ts):
   - Add `ss.min_order_value` / `ss.min_order_quantity` to `DATA_SQL` and to `DataRow`; map in `getData` (coerce DECIMAL string → number, keep `null` when unset).
   - Implement `setMinimums`: `INSERT INTO supplier_schedule (supplier_id, schedule_type, min_order_value, min_order_quantity) VALUES (?, 'lead_time', ?, ?) ON DUPLICATE KEY UPDATE min_order_value = VALUES(min_order_value), min_order_quantity = VALUES(min_order_quantity)` — never touches schedule_type/week_day/month_day/last_ordered_at on an existing row (FR-4).

5. **Admin use case** — new [SetSupplierMinimumUseCase.ts](../../app/(authenticated)/admin/application/SetSupplierMinimumUseCase.ts): `execute({ supplierId, minOrderValue, minOrderQuantity })` → `repository.setMinimums(...)`. Pure orchestration (mirrors `UpdateSupplierScheduleUseCase`).

6. **Container** — [container.ts](../../container.ts): `createSetSupplierMinimumUseCase()` returning `new SetSupplierMinimumUseCase(new MySQLSupplierScheduleRepository())` (mirror `createUpdateSupplierScheduleUseCase`, line 255).

7. **Admin API** — new [order-scheduling/minimums/api/route.ts](../../app/(authenticated)/admin/order-scheduling/minimums/api/route.ts), PUT:
   - Gate with `requirePermission("admin.order_scheduling")` (same as the schedule PUT).
   - Validate: `supplierId` positive int; `minOrderValue` = `null` or number ≥ 0 with ≤ 2 decimals; `minOrderQuantity` = `null` or integer ≥ 0. Reject invalid `400` with a field message (FR-3, fail-fast). Empty/blank field → `null` (clears).
   - Resolve `createSetSupplierMinimumUseCase().execute(...)`; return minimal `{ success: true }`. No business logic in the handler (CLAUDE.md).

8. **Admin Kanban UI** — [OrderSchedulingKanban.tsx](../../app/(authenticated)/admin/OrderSchedulingKanban.tsx):
   - `SupplierCardBody`: add a "Set minimum" button (reuse `Button size="sm" variant`) opening a `Dialog` (reuse the existing `Dialog` primitives already imported) with two optional `Input type="number"` fields pre-filled from `supplier.minOrderValue`/`minOrderQuantity`. Clearing a field submits `null`.
   - On save: PUT `/admin/order-scheduling/minimums/api`, then update local `schedules` state (mirror the `persist` optimistic-update pattern, lines 141–179).
   - Show a small `Badge` on the card when either minimum is set (§8 step 4). Money formatting: peso with thousands separators (FR-18).

9. **Replenishment domain** — [ReplenishmentItem.ts](../../app/(authenticated)/replenishment/domain/ReplenishmentItem.ts): add `unitCost: number` to `ReplenishmentItem`; add `minOrderValue: number | null` + `minOrderQuantity: number | null` to `SupplierGroup`.

10. **Replenishment read SQL** — [MySQLReplenishmentRepository.ts](../../app/(authenticated)/replenishment/infrastructure/MySQLReplenishmentRepository.ts):
    - Add `it.COST` to the `supplier_items` CTE select and to the final SELECT (`COALESCE(si.COST, 0) AS unit_cost`); add `unit_cost` to `CandidateRow`; set `unitCost: Number(row.unit_cost)` on each built item. `COST` is per base unit (same basis `MySQLPurchaseOrderRepository.expandOrderLine` uses).
    - `SeedReplenishmentRepository.ts`: add a plausible `unitCost` so the seed path type-checks and stays parity-correct.

11. **Replenishment API read** — [api/route.ts](../../app/(authenticated)/replenishment/api/route.ts): after fetching `dueStatuses`, also read supplier minimums. Simplest: extend `GetSupplierDueStatusesUseCase` output is due-only, so fetch minimums from the same `SupplierScheduleData` — either (a) add `minOrderValue`/`minOrderQuantity` to `SupplierDueStatus` in [GetSupplierDueStatusesUseCase.ts](../../app/shared/application/GetSupplierDueStatusesUseCase.ts) (it already reads `getData`), or (b) map straight from the schedule rows. Prefer (a): one round-trip already exists. Attach both onto each `groupsWithDue` entry.

12. **Replenishment page — state + indicator** — [page.tsx](../../app/(authenticated)/replenishment/page.tsx):
    - Build a `supplierMinimums: Map<supplierId, {value: number|null; qty: number|null}>` from the fetched Standard groups.
    - Add `unitCost` to `POLineState` and carry it from the item in `handleGeneratePO` (line 746) and wherever review lines are built.
    - Helper `computeSupplierRunning(supplierId, lines/items, checkedSet)` → `{ runningValue, runningQuantity }`: ₱ = Σ over checked lines of `caseQty × unitCost × conversionFactor + pieceQty × unitCost`; qty = Σ `caseQty + pieceQty`. On the **main list** the "lines" are the checked items at their current period/rounding suggestion; on **Review** they are `POLineState` final qtys (respecting per-piece toggle) (FR-8, FR-9, FR-10, FR-12).
    - Render the indicator on Standard supplier headers (main list header + Review supplier section) only when a minimum is set: `₱{running} / ₱{min} min` and/or `{running} / {min} units min`, in the `warning` token when below, neutral when met (FR-6, FR-7, FR-11). Reuse existing header layout; no new visual system.

13. **Replenishment page — Submit warning** — in `handleSubmitPO` (line 919): before POSTing, compute per-supplier running totals across that supplier's selected lines (summed across manufacturer splits — FR-11) and find suppliers below **either** minimum. If any, open a confirm `Dialog` listing each with its shortfall(s) and **Submit anyway** / **Cancel** (FR-13–FR-16). Suppliers with no selected lines are skipped (§9). On "Submit anyway", include a `belowMinAck` array `[{ supplierId, minOrderValue, minOrderQuantity, runningValue, runningQuantity }]` in the payload; no below-minimum suppliers → submit directly with no dialog and no ack.

14. **PO domain + API passthrough** — [PurchaseOrder.ts](../../app/(authenticated)/replenishment/domain/PurchaseOrder.ts): add `belowMinAck?: Array<{ supplierId: number; minOrderValue: number | null; minOrderQuantity: number | null; runningValue: number; runningQuantity: number }>`. [api/po/route.ts](../../app/(authenticated)/replenishment/api/po/route.ts): thread `belowMinAck` into `enrichedBody` (validate shape defensively; never reject on it — advisory).

15. **PO repo — persist FR-17** — [MySQLPurchaseOrderRepository.ts](../../app/(authenticated)/replenishment/infrastructure/MySQLPurchaseOrderRepository.ts): in the `replenishment_run` INSERT (lines 303–319), when `path === "standard"` and `po.belowMinAck?.length`, set `below_min_acknowledged = 1` and `below_min_details = JSON.stringify(po.belowMinAck)`; otherwise `0` / `NULL`. Stockout run row always `0`/`NULL` (FR-18). Same atomic transaction (already the case).

## Risks & Open Questions
- **Item `COST` correctness on live ActiveOne.** The ₱ total leans on `item.COST` (per base unit). Verify against live data that `COST` is populated and per-base — the memory note [ActiveOne Verified Constants] flags that several assumed constants were wrong. Missing/zero cost → line contributes ₱0 (FR-15, acceptable/advisory).
- **`GetSupplierDueStatusesUseCase` is shared** (supplier screen, landing badge, replenishment). Adding minimum fields to `SupplierDueStatus` is additive and safe, but confirm the supplier-selection screen and badge ignore the new fields (they should — no behavior change).
- **Running-total parity between main list and Review.** Main-list totals use per-item current-period suggestions; Review uses `POLineState` (may include per-piece splits and qty overrides). Ensure both use the same `unitCost × factor` basis so the number doesn't visibly jump between screens for unchanged selections (FR-12).
- **`below_min_details` JSON column type.** Use `JSON` if the target MySQL supports it (8.0 does); otherwise `longtext`. Confirm against the deployed engine (schema already uses `utf8mb4_0900` → MySQL 8, so `JSON` is safe).
