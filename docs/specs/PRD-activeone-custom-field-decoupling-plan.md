# Implementation Plan: Decouple App Metadata from ActiveOne `purchase_order` Custom Fields
Source PRD: [PRD-activeone-custom-field-decoupling.md](./PRD-activeone-custom-field-decoupling.md)
Date: 2026-07-02

## Summary
Stop the app from writing to ActiveOne's `purchase_order.CUSTOM_FIELD1/2/3` (columns ActiveOne owns and populates itself), and source the two pieces of load-bearing logic from app-owned tables that already store the same facts. Delivery stops writing CF1/CF2 and identifies its own supersede POs via `delivery.new_po_id` instead of `CUSTOM_FIELD1` — which also fixes a latent bug where ~99.6% of real open POs were being hidden from the receiving grid. Replenishment stops writing CF3; the manufacturer label already lives in `replenishment_run_po`, which gains a `po_id` join key for the future PO-list module. The change is almost entirely subtractive: no new tables, no new ports, no `container.ts` change.

## Affected Areas
- **Delivery — infrastructure only:** [MySQLDeliveryRepository.ts](../../app/(authenticated)/delivery/infrastructure/MySQLDeliveryRepository.ts)
  - `getOpenPurchaseOrders` (grid query, ~L95-110)
  - `getPurchaseOrderForReceiving` (guard, ~L123-135)
  - `commit` → supersede optimistic-concurrency SELECT/guard (~L181-192)
  - `commit` → supersede-PO INSERT (~L329-336)
  - `PoHeaderRow` type (drop `CUSTOM_FIELD1` field, ~L35)
- **Replenishment — infrastructure only:** [MySQLPurchaseOrderRepository.ts](../../app/(authenticated)/replenishment/infrastructure/MySQLPurchaseOrderRepository.ts)
  - PO INSERT (~L162-169) — drop `CUSTOM_FIELD3`
  - snapshot push (~L212-220) and `persistRunSnapshot` (~L233-264) — thread `poId` into `replenishment_run_po`
- **DB migration:** [scripts/create-app-tables.sql](../../scripts/create-app-tables.sql)
  - Add index `ix_delivery_new_po_id` on `delivery.new_po_id`
  - Add nullable column `replenishment_run_po.po_id` (int)
- **Shared:** none. `activeoneConstants.ts` unchanged (`LEAD_TIME_FIELD = CUSTOM_FIELD4` read-only stays; `EMPLOYEE_CONTACT_TYPE` doc comment mentioning CF2 is stale but non-functional — see Step 7).
- **container.ts:** no change (no new ports or use cases).
- **Domain / application / page.tsx / api/route.ts:** no change — this is a pure infrastructure/persistence swap; contracts and behavior are preserved.

## Decisions
- **Resolved by AI — Reuse existing tables, add no new ones.** `delivery` already stores `original_po_id/code`, `new_po_id`, `received_by_employee_code`; `replenishment_run_po` already stores `po_code` + `manufacturer_id/name` in the same transaction. Adding a table would duplicate app-owned facts (DRY; PRD §1, §5).
- **Resolved by AI — Delivery supersede identity = membership in `delivery.new_po_id`.** It is the ActiveOne PO primary key, written atomically with the supersede PO, so it is exact and always consistent (PRD FR-4).
- **Resolved by developer (prior turn) — Keep the manufacturer label; `replenishment_run_po` is its home.** ("keep it in side table … we already have a replenishment run po, maybe it can help.")
- **Resolved by AI — Accept O1: add `replenishment_run_po.po_id`.** The point of keeping the label is future queryability; the minted `poId` is already in scope at snapshot time (near-zero cost) and gives the planned PO-list module a PK join instead of a `po_code` string match (PRD FR-11, O1). Nullable so existing rows stay valid.
- **Assumption — No production/shared cleanup needed.** The app has never written to production ActiveOne (per memory: no live ActiveOne yet), so there is no prior CF1/CF2/CF3 app data to unwind; the migration is additive only (PRD §8).
- **Assumption — No reader of CF1/CF3 outside the code being changed.** Verified by grep: the only app readers of `purchase_order` custom fields are Delivery's CF1 gate (being rewired) and there is no reader of CF3. Step 1 re-confirms this before deletion.

## Implementation Steps

### Step 1 — Pre-flight sweep (confirm no other readers/writers)
Before editing, grep the repo for `CUSTOM_FIELD` across `app/**/*.ts` to reconfirm: only `purchase_order` is written (Delivery CF1/CF2, Replenishment CF3), and `contact.CUSTOM_FIELD4` (lead time) is the only read that stays. This guards FR-3/FR-10. No code change; it validates the assumptions above.

### Step 2 — DB migration (`scripts/create-app-tables.sql`)
Using the existing idempotent prepared-statement ALTER pattern already in the file (see the `@add_del_original_po_code` / `@del_idx_new_po_code` blocks, ~L300-416):
- Add index: `ALTER TABLE delivery ADD INDEX ix_delivery_new_po_id (new_po_id)` — guarded by an `information_schema.STATISTICS` existence check like the sibling index blocks.
- Add column: `ALTER TABLE replenishment_run_po ADD COLUMN po_id int NULL AFTER po_code` — guarded by an `information_schema.COLUMNS` existence check like `@del_has_original_po_code`.

Do this first so the index/column exist before the new queries rely on them.

### Step 3 — Delivery: stop writing CF1/CF2 on the supersede INSERT
In `commit`, the supersede `INSERT INTO purchase_order` (~L329-336): remove `CUSTOM_FIELD1, CUSTOM_FIELD2` from the column list and remove the two corresponding placeholders + bound values (`original.CODE`, `input.receiverEmployeeCode`). All other columns unchanged. The receiver code and original code remain fully captured by the subsequent `persistDeliveryRecord` write into the `delivery` table (FR-1).

### Step 4 — Delivery: rewire the open-PO grid exclusion
In `getOpenPurchaseOrders` (~L95-110): replace
`AND (po.CUSTOM_FIELD1 IS NULL OR po.CUSTOM_FIELD1 = '')`
with
`AND NOT EXISTS (SELECT 1 FROM delivery d WHERE d.new_po_id = po.ID)`.
This makes real ActiveOne POs (which nearly all carry a CF1 value) visible again while still hiding app-created supersede POs (FR-5, FR-8).

### Step 5 — Delivery: rewire the receiving-eligibility guard
In `getPurchaseOrderForReceiving` (~L123-135): drop `po.CUSTOM_FIELD1` from the header SELECT, and replace `if (header.CUSTOM_FIELD1) return null;` with a membership test on `delivery.new_po_id`. Simplest: add `AND NOT EXISTS (SELECT 1 FROM delivery d WHERE d.new_po_id = po.ID)` is not usable here (single-row fetch by ID that must distinguish null-vs-excluded), so instead select a flag, e.g.
`EXISTS (SELECT 1 FROM delivery d WHERE d.new_po_id = po.ID) AS isAppPo`
and `if (header.isAppPo) return null;`. Keep the existing `STATUS !== PO_OPEN_STATUS` reject (FR-6).

### Step 6 — Delivery: rewire the supersede concurrency guard
In `commit` (~L181-192): drop `po.CUSTOM_FIELD1` from the `FOR UPDATE` header SELECT and add the same `EXISTS (... d.new_po_id = po.ID) AS isAppPo` flag. Change the guard to
`if (!original || original.STATUS !== PO_OPEN_STATUS || original.isAppPo) throw new PurchaseOrderAlreadyReceivedError();`
Then update the `PoHeaderRow` type (~L35): remove `CUSTOM_FIELD1`, add `isAppPo` (number/boolean as returned by MySQL `EXISTS`). Verify the type is shared by both SELECTs (grid header vs. receiving header) — if the shapes diverge, give each its own row type or make `isAppPo` optional (FR-4, FR-7).

### Step 7 — Refresh stale doc comments
Update the `EMPLOYEE_CONTACT_TYPE` comment in [activeoneConstants.ts](../../app/shared/infrastructure/activeoneConstants.ts#L49-L56): it states Delivery "writes it to the superseding PO's CUSTOM_FIELD2." Reword to note the receiver code is now persisted in the app-owned `delivery.received_by_employee_code` (no ActiveOne write). No functional change.

### Step 8 — Replenishment: stop writing CF3, add `po_id` to the run-PO snapshot
- PO INSERT (~L162-169): remove `CUSTOM_FIELD3` from the column list and remove its placeholder + the bound `manufacturerName`. Everything else unchanged (FR-2).
- Snapshot push (~L212-220): add `poId` to the pushed object (it is already in scope from the mint at ~L167).
- `persistRunSnapshot` (~L233-264): add `poId: number` to the `poRows` param type, and add `po_id` to the `INSERT INTO replenishment_run_po` column list + its value (FR-9, FR-11).
- Confirm no code reads `purchase_order.CUSTOM_FIELD3` (history/PO-summary read from run snapshots) before removing the write (FR-10; covered by Step 1).

### Step 9 — Verify against the full-year dump
Run replenishment/delivery paths (or targeted queries) against `greatwall_activeone` and confirm:
- The Delivery grid now returns real open POs that previously vanished under the CF1 filter (the bug fix).
- An app-created supersede PO (present in `delivery.new_po_id`) is still excluded from the grid and non-receivable.
- A generated replenishment PO row has `CUSTOM_FIELD3 = NULL`, its `replenishment_run_po` row has the correct `po_id` + `manufacturer_name`, and history/PO summary still render the manufacturer.

## Risks & Open Questions
- **`EXISTS`-flag typing across two SELECTs (Step 6).** `PoHeaderRow` is reused by the grid and receiving/commit headers; adding `isAppPo` to one but not another can break typing. Verify actual usages with `find_referencing_symbols` on `PoHeaderRow` and adjust (separate row types if needed).
- **Grid performance.** The `NOT EXISTS` anti-join runs over all open POs across locations; `ix_delivery_new_po_id` (Step 2) keeps it cheap, but confirm the plan uses the index on the dump.
- **Historical `delivery` rows without the mapping.** Not a concern — `delivery.new_po_id` is `NOT NULL` in the base schema and has always been written on commit, so every app supersede PO is covered.
- **Nothing to migrate in ActiveOne** — additive migration only; if a shared/staging env unexpectedly holds app-created POs, they still carry their `delivery.new_po_id` mapping, so the new gate covers them with no backfill.
