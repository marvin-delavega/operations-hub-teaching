# PRD: Inventory Counting

Date: 2026-07-03

## 1. Overview

Inventory Counting is a new Operations Hub module — a floor tool for physically counting stock at a location by scanning barcodes with an Eyoyo Bluetooth scanner. It is structurally the sibling of the Delivery module (scan = +1, Continuous Scanning setting, Review step, per-action admin auth, `localStorage` resilience), but simpler: there is **no PO**, so there are **no Under / Over / Not-Ordered / New-Item statuses** and nothing to supersede. A saved count writes an ActiveOne `inventory_count` document (header + lines) and a self-contained copy in our own `stock_count` tables. Counting **does not adjust on-hand** (`item_inventory` is untouched) — it only records counted quantities; a later, separate inventory-adjustment process can reconcile on-hand against a count.

## 2. Goals

- Let floor staff count stock at a single location fast, by scanning, with one scan = +1 in the item's location-configured unit.
- Persist each committed count as an ActiveOne `inventory_count` + `inventory_count_items` document, correctly attributed (who counted, which ERP login recorded it).
- Persist a self-contained, immutable mirror of every count in our own `stock_count` / `stock_count_items` tables for a future Counting History.
- Reuse existing app patterns (Delivery scanning flow, admin settings tab, shared `/location` selection, Users-tab pickers) so the module is consistent and low-surprise.
- Never touch on-hand — counting is recording only; reconciliation is out of scope.

## 3. Non-Goals

- **No on-hand adjustment.** `item_inventory` is never written. `inventory_count.ADJUSTED` is written `0` (not reconciled).
- **No inventory-adjustment / reconciliation flow.** Deferred to a separate future process that consumes the count.
- **No Counting History viewer.** The mirror tables are populated now, but the browsing/audit UI is deferred (mirrors how Delivery History was split out).
- **No Blind Counting.** Considered and dropped — with no expected/ordered reference it adds no value.
- **No Under / Over / Not-Ordered / New-Item line statuses.** Every counted line is just an item and a quantity.
- **No manual (non-scan) item entry in v1.** Items enter a count only by scanning a resolvable barcode.
- **No PO, no supersede, no incoming, no unit-of-measure choice by the user.** Unit is derived, not selected.

## 4. Users & Roles

- **Any authenticated role (staff or admin)** may run a count and trigger Save.
- **Save is hard-gated** — the logged-in user must have **both**:
  1. An **ActiveOne employee-contact link** (`users.employee_code`, a TYPE-2 contact `ACCOUNT_NO`) → resolves to `inventory_count.COUNTED_BY_ID`.
  2. An **ActiveOne login-user mapping** (new per-user field, see §6) → written to `inventory_count.RECORDED_BY_ID`.
  A user missing either is blocked from saving with a clear message (analogous to Delivery's missing-employee-link block).
- **Edit / Delete of a count line requires admin authorization** — an admin password re-entered **per individual action** (same model as Delivery's manual-qty changes). Pure scanning and undo-last-scan need no auth.
- **Admins** additionally: configure the Counting settings (Continuous Scanning), manage per-user ERP-login mappings in the Users tab, and control per-location visibility for the counting module.

## 5. Functional Requirements

### Selection & entry
- **FR-1** Entering the module (from the home launcher card) starts a **location-only** selection via the shared `/location` module with `module=counting`. No supplier step, no other selection.
- **FR-2** Location visibility for `module=counting` is governed by `module_location_visibility` (absent = visible) and configurable from `/admin`, like other modules.
- **FR-3** After a location is chosen, the counter lands on an initially **empty** counting screen scoped to that location.

### Scanning
- **FR-4** One scan resolves the barcode to an ActiveOne item by `item.CODE`. On success the item's line is **incremented by +1** in the item's location-configured unit (see FR-9). A duplicate scan of an already-counted item increments the **same** line.
- **FR-5** If a scan does **not** resolve to a known ActiveOne item, it is **rejected with clear feedback** (audible/visual), and nothing is added. There is no New-Item capture.
- **FR-6** The scan handler must process rapid back-to-back scans (Eyoyo batch dumps) without dropping any.
- **FR-7 (Undo last scan)** A no-auth **Undo last scan** reverses the most recent scan/entry (in Continuous-OFF mode it reverses the whole last quantity entry). Requires no admin auth.
- **FR-8 (Continuous Scanning setting)** Global `app_settings` key `counting_continuous_scanning` (default **ON**):
  - **ON:** each scan is +1 directly.
  - **OFF:** each scan opens an empty, focused **quantity modal** that **adds** the entered amount to the line (positive whole numbers only, no auth); scans are **swallowed** while the modal is open; cancel is a no-op. This is the counter's path for typing large counts without admin.
- The setting is read **live at screen load** (location entry), not snapshotted into `localStorage`; a changed setting applies on the next count.

### Unit resolution
- **FR-9** The count/display unit for each item is resolved for the **selected location** from `item_location_units` (the three unit roles — purchases/sales/shipping — are effectively identical, ~100% agreement). The conversion factor is taken from `item_units` (matching `ITEM_ID` + `UNIT_ID`). If no `item_location_units` row exists for the item at that location, fall back to the item's global `PURCHASES_UNIT_ID` (or `BASE_UNIT_ID` if null), factor 1.
- **FR-10** Each line displays the resolved unit symbol (`unit_of_measure.SYMBOL`, e.g. "cs", "pk", "pc"). Quantities are shown/entered as plain **whole numbers** in that purchase unit.
- **FR-11** Quantities are **positive whole numbers only** — via scan (+1), the Continuous-OFF modal, and admin edits.

### Review & admin edits
- **FR-12** A **Review step** (mirroring Delivery) lists all counted lines (item, unit, counted quantity) before commit.
- **FR-13** On Review, an **optional free-text note** may be entered (e.g. section/brand/reason); it is written to `inventory_count.NOTES` and mirrored to `stock_count`.
- **FR-14** **Edit** a line's quantity or **Delete** a line requires an **admin password per action**. Any positive-whole-number quantity is allowed.

### Save / commit
- **FR-15** Save is **blocked** unless the counter passes the hard gate (FR under §4) and the count has **≥ 1 line** (empty-count guard, enforced at the API boundary and in the UI).
- **FR-16** On Save, within **one atomic transaction**, write:
  - **ActiveOne** `inventory_count` (header) + `inventory_count_items` (lines).
  - **Our DB** `stock_count` (header) + `stock_count_items` (lines) — a self-contained immutable snapshot including human-readable labels.
- **FR-17** ERP header values: `CODE` = next app-minted zero-padded 4-digit sequence (its own numbering, independent of `ID`; `ID` minted `MAX(ID)+1`); `DATE` and `STATUS_DATE` = today (Asia/Manila); `RECORDED_ON` = now; `LOCATION_ID` = selected location; `COUNTED_BY_ID` = counter's employee contact; `RECORDED_BY_ID` = counter's mapped ERP login user; `STATUS` = `3` (finalized); `ADJUSTED` = `0`; `NOTES` = optional note or null; `CUSTOM_FIELD1..5` = null.
- **FR-18** ERP line values: `INVENTORY_COUNT_ID` = new header ID; `LINE_NO` sequential; `ITEM_ID` = resolved item id; `DESCRIPTION` = null; `QUANTITY` = counted quantity in display unit; `UNIT_ID` = resolved unit; `UNIT_BASE_QUANTITY` = resolved factor; `CLOSED` = `1`; `INVENTORY_ADJUSTMENT_ITEMS_ID` = null; `CUSTOM_FIELD1..5` = null; `BATCH_ID` = null.
- **FR-19** No supersede and no optimistic-concurrency re-read — a Save creates a **new independent** document. Two people counting the same location simultaneously simply create two separate documents; that is allowed.
- **FR-20** All dates and "today" use **Asia/Manila** (UTC+8), consistent with the app-wide rule.

### Resilience
- **FR-21** In-progress count state persists to `localStorage`, keyed per location, and is restored on return.
- **FR-22** On successful save, show a **success summary** screen and **clear** the per-location `localStorage` draft.

### Admin — settings & user mapping
- **FR-23** A new **Counting** settings tab in `/admin` (mirroring the Delivery tab) exposes the **Continuous Scanning** toggle (`counting_continuous_scanning`).
- **FR-24** The `/admin` **Users** tab gains an **ActiveOne login-user** field per user, set via a **live searchable picker over the ActiveOne `user` table** (mirroring the existing employee-contact picker). This value is optional to set but **required to save a count** (hard gate).

## 6. Data Model

### ActiveOne (write target — existing tables)

**`inventory_count`** (header) — written per committed count:

| Column | Value written |
|---|---|
| `ID` | `MAX(ID)+1` |
| `CODE` | next zero-padded 4-digit sequence (`MAX(CAST(CODE AS UNSIGNED))+1`, min width 4) |
| `DATE` | today (Asia/Manila) |
| `RECORDED_ON` | now |
| `LOCATION_ID` | selected location |
| `COUNTED_BY_ID` | counter's employee contact id (from `users.employee_code` → `Contact.ACCOUNT_NO`, TYPE 2) — **NOT NULL** |
| `RECORDED_BY_ID` | counter's mapped ActiveOne login-user id — **NOT NULL** |
| `NOTES` | optional note, else null |
| `STATUS` | `3` (finalized) |
| `STATUS_DATE` | today (Asia/Manila) |
| `ADJUSTED` | `0` |
| `CUSTOM_FIELD1..5` | null |

**`inventory_count_items`** (lines) — one per counted item:

| Column | Value written |
|---|---|
| `ID` | minted |
| `INVENTORY_COUNT_ID` | header id |
| `LINE_NO` | sequential |
| `ITEM_ID` | resolved item id |
| `DESCRIPTION` | null |
| `QUANTITY` | counted qty (display unit) |
| `UNIT_ID` | resolved unit (§FR-9) |
| `UNIT_BASE_QUANTITY` | resolved factor |
| `CLOSED` | `1` |
| `INVENTORY_ADJUSTMENT_ITEMS_ID` | null (deferred downstream link) |
| `CUSTOM_FIELD1..5`, `BATCH_ID` | null |

Unit resolution reads `item_location_units` (per location) + `item_units` (factor) + `unit_of_measure` (symbol). Barcode → item resolution is against the ActiveOne item masterlist by `item.CODE`.

### Our DB (new app-owned tables, same `greatwall_activeone` database, created via the idempotent `create-app-tables.sql` pattern)

**`stock_count`** (header, immutable self-contained mirror) — includes the ERP header facts **plus human-readable labels** so records survive ActiveOne renames: location name, counter (employee) display name, recorder display name, the mode setting in effect (continuous scanning on/off), the minted ERP `inventory_count` reference (CODE/ID), created-at, optional note. Exact columns finalized at implementation.

**`stock_count_items`** (lines): per-line item id + item name/label, unit id + unit symbol, factor, counted quantity. Snapshot, not a live join.

### Users table (extend existing `users`)

- New nullable column for the **ActiveOne login-user id** mapping (name finalized at implementation, e.g. `activeone_user_id`), added via the idempotent ALTER pattern in `create-app-tables.sql`. Used only as `inventory_count.RECORDED_BY_ID`.

### `app_settings`

- New key `counting_continuous_scanning` (default ON), analogous to `delivery_continuous_scanning`.

## 7. API Contract

Following the module's clean-architecture layout (`app/(authenticated)/counting/…`, HTTP adapter in `api/route.ts`, use cases resolved from `container.ts`):

- **Commit count** — `POST /counting/api` (or a specific sub-route).
  - **Request:** `{ locationId, note?, lines: [{ itemId, quantity }] }` plus session-derived user identity. (Unit/factor may be resolved server-side from `itemId` + `locationId`, or supplied and re-validated server-side.)
  - **Server validation (fail-fast):** session valid; user has employee link **and** ERP-login mapping (else 4xx with a gate reason); `lines` non-empty; every `itemId` resolves to a real item; quantities are positive whole numbers.
  - **Behavior:** in one transaction, mint ids/CODE, resolve units, insert `inventory_count` + `inventory_count_items` and `stock_count` + `stock_count_items`.
  - **Response:** minimal confirmation — `{ code, inventoryCountId }` and a summary for the success screen. (Command; returns confirmation only.)
- **Admin action authorization** for per-action edit/delete reuses the existing admin-password verification endpoint/use case used by Delivery.
- **Barcode/masterlist resolution** and **unit lookup** reuse existing read paths (GET; no state change).
- **Continuous Scanning setting** read via the existing `app_settings` read path.
- **ERP-login-user picker** — a GET search over the ActiveOne `user` table (admin-only), mirroring the employee-contact picker used by the Users tab.

All GETs are side-effect-free; the commit is the only state-changing call (Command-Query Separation).

## 8. UI/UX Flow

1. **Home launcher** → tap the Counting card → **`/location?module=counting&returnTo=…`**.
2. **Location selection** (shared module) → appends `locationId`, returns to `/counting?locationId=…`.
3. **Counting screen** (empty, focused for scanner input), scoped to the location. Continuous Scanning mode read live.
   - **Continuous ON:** each scan adds +1 to the item's line; the line list grows/updates with item name, unit symbol, running quantity.
   - **Continuous OFF:** each scan opens a focused quantity modal (whole numbers) that adds to the line; scans swallowed while open; cancel = no-op.
   - **Unknown barcode:** rejected with clear feedback; nothing added.
   - **Undo last scan:** reverses the most recent entry, no auth.
4. **Review** → full line list (item, unit, quantity) + **optional note** field.
   - **Edit quantity / Delete line** → prompts for an **admin password per action**.
5. **Save** → hard gate checked; empty-count guard checked → atomic commit to ERP + our mirror.
6. **Success summary** → shows the minted count reference and per-line summary; per-location `localStorage` draft cleared. Return to home/new count.

Resilience: leaving and returning to the same location restores the in-progress draft from `localStorage`.

## 9. Edge Cases & Error Handling

- **Unknown/unmapped barcode** → reject with audible/visual feedback; no line added (FR-5).
- **Item has no `item_location_units` row for the location** → fall back to the item's global purchase/base unit, factor 1 (FR-9); counting proceeds.
- **User lacks employee link and/or ERP-login mapping** → Save blocked with a clear, specific message naming what's missing; no partial write.
- **Empty count (zero lines)** → Save blocked at UI and API (FR-15).
- **Rapid scan bursts** → all scans processed, none dropped (FR-6).
- **Duplicate item scans** → increment the same line, never create duplicate lines (FR-4).
- **Continuous-OFF modal open** → incoming scans swallowed until modal resolves (FR-8).
- **Two simultaneous counts of one location** → allowed; each Save creates an independent `inventory_count` document (FR-19).
- **Interrupted session / reload** → draft restored from per-location `localStorage`; cleared only on successful save (FR-21/22).
- **Partial ERP/mirror write failure** → whole transaction rolls back; nothing persisted; error surfaced.
- **Non-whole or non-positive quantity attempted** → rejected (FR-11).

## 10. Open Questions

- Exact new column name on `users` for the ERP-login mapping (proposed `activeone_user_id`) and exact `stock_count` / `stock_count_items` column set — finalized at implementation.
- Whether the ERP `user` picker should filter to active logins only (e.g. `STATUS`/`TYPE` filters) — to be confirmed against live ERP semantics during implementation (dev dump shows mixed `STATUS`/`TYPE` values).
- Whether the commit request should send resolved unit/factor or resolve them entirely server-side (leaning server-side resolution for a single source of truth).

## 11. Out of Scope / Deferred

- **On-hand adjustment / reconciliation** consuming the count (`inventory_adjustment*`, `INVENTORY_ADJUSTMENT_ITEMS_ID` linkage) — future, separate process.
- **Counting History** browsing/audit UI — deferred; mirror tables are populated now so data exists when it's built.
- **Blind Counting** — dropped.
- **Manual (non-scan) item entry** — deferred to a later iteration.
- **Multi-user merge / collaborative single-document counting** — not needed; separate documents suffice.
