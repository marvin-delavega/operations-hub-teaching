# PRD: Delivery Receiving
Date: 2026-06-24

## 1. Overview

The Delivery module is the floor tool for receiving goods against an ActiveOne Purchase Order. A checker selects an open PO, scans arriving items with an Eyoyo Bluetooth scanner (one scan = +1), and the screen tracks received-vs-ordered in real time. On save, the module supersedes the original PO: it writes a **new** ActiveOne purchase order reflecting the actual quantities received and **closes** the original (preserved, not deleted) with an audit link between them. This inserts the app as the missing receiving step in ActiveOne's native `PO → Enter Bill` flow — an admin later runs Enter Bill in ActiveOne to post stock and close the new PO.

## 2. Goals

- Let floor staff receive a PO by scanning, with zero screen taps between scans.
- Classify every received line: Exact, Over Served, Under Served, Not Ordered, New Item.
- Capture unknown SKUs (not in the ActiveOne masterlist) as raw records without breaking ActiveOne referential integrity.
- Write actual-received quantities back to ActiveOne as a new PO and supersede the original without duplicating "incoming" quantities in replenishment.
- Preserve a full audit trail in ActiveOne (original PO closed, new PO links back to it; receiver recorded).
- Survive refresh/disconnect without losing in-progress scans.
- Keep manual quantity manipulation behind admin authorization while keeping pure scanning open to all staff.

## 3. Non-Goals

- No location selection step — the open-PO list spans all locations; each PO carries its own location.
- No full offline scanning for Phase 1 (localStorage resilience only; no buffered upload-later mode).
- No use of ActiveOne's `item_receive` document (it belongs to a separate process).
- No creation/naming of New Items in ActiveOne from this module — that is an admin task downstream.
- No Enter Bill / stock posting inside this app — that remains a manual step performed by an admin in ActiveOne.
- No admin-override audit log in Phase 1 (deferred to a future audit module).
- No multi-PO receiving in one session (one PO per session).
- No Delivery History UI (separate module, requirement 2.4).

## 4. Users & Roles

- **Floor staff** — can open Delivery, select a PO, scan items, undo the last scan, and commit (Save Delivery). Cannot perform arbitrary manual quantity edits.
- **Admin** — everything staff can do, plus authorizing manual quantity edits via per-action password verification.
- Module visibility: **all roles** see the Delivery card on the launcher.
- **Hard requirement:** every app user must be linked to an ActiveOne **type-2 (employee)** contact. Save is blocked if the current user has no linked employee.

## 5. Functional Requirements

### PO Selection
- **FR-1** The Delivery landing screen lists **open** POs (`STATUS = 0`) across **all locations** as a searchable card grid (same selection-tile pattern as `/supplier`).
- **FR-2** Each PO card shows: PO code, PO date, expected delivery date (PO date + supplier lead time from `contact.CUSTOM_FIELD3`), supplier name, total items (line count), and total quantity.
- **FR-3** A search input filters cards by **PO number/code** (case-insensitive, partial match).
- **FR-4** POs that have `CUSTOM_FIELD1` set (app-created delivery POs) are **excluded** from the list, preventing a re-receive loop.
- **FR-5** Selecting a PO opens a single receiving session for that PO. One PO per session.

### Scanning & Classification
- **FR-6** Each scan resolves the barcode to `item.CODE` and increments the matching line's received count by **1**, then instantly clears for the next scan — no manual tap required.
- **FR-7** Counting is in the PO's **purchase unit**; one scan = +1 purchase unit. No base/purchase conversion occurs during receiving. (Operationally ensuring a scanned piece represents a full case is the staff's responsibility, out of scope.)
- **FR-8** The scan handler must reliably process rapid, back-to-back scans (Eyoyo batch-memory dumps arrive as a fast keystroke stream) without dropping scans.
- **FR-9** On each scan the system classifies the barcode into one of three cases:
  - **(a) On the PO** → increment that line.
  - **(b) In the masterlist cache but not on this PO** → add a new line, status **Not Ordered**, description from the masterlist cache.
  - **(c) Not in the masterlist cache** → add a new line, status **New Item**, description literal `"New Item"`, stored only in our own delivery child table.
- **FR-10** Per-line status is derived continuously:
  - **Exact** — ordered > 0 and received = ordered.
  - **Over Served** — ordered > 0 and received > ordered.
  - **Under Served** — ordered > 0 and received < ordered (including received = 0).
  - **Not Ordered** — ordered = 0, received > 0, item exists in masterlist.
  - **New Item** — received > 0, item not in masterlist.

### Manual Edits & Authorization
- **FR-11** **Undo last scan**: any user may decrement the most-recently-scanned item by 1 with no authorization (quality-of-life correction).
- **FR-12** Any **other** manual change — typing an arbitrary quantity, decrementing an arbitrary line, or deleting a line — requires **admin password verification, re-entered for each individual action**. There is no session-level unlock.
- **FR-13** Pure scanning and undo-last-scan are the only quantity actions available without admin authorization.

### Local Resilience
- **FR-14** In-progress receiving state is persisted to `localStorage` (keyed per PO) so a refresh, crash, or brief disconnect does not lose scans. State is cleared on successful save.

### Review & Save
- **FR-15** A dedicated **Review screen** precedes commit, listing every line with ordered, received, and status.
- **FR-16** The Review screen header summary shows: supplier name, total items, total quantity, and a status breakdown (counts of Exact / Over Served / Under Served / Not Ordered / New Item).
- **FR-17** Manual edits (FR-12 rules) are available on the Review screen.
- **FR-18** **Save Delivery** may be triggered by **floor staff** (no admin gate on the commit itself).
- **FR-19** Save is **blocked** if the current user has no linked ActiveOne employee (FR section 4).
- **FR-20** At commit, the system **re-reads the original PO and verifies it is still open**. If it has been closed/superseded since selection, the save is rejected with a clear message (optimistic concurrency).

### Write-Back (atomic transaction)
- **FR-21** On successful save, within a single transaction:
  - **(a)** Write a **new** `purchase_order` (+ `purchase_order_items`) with the actual received quantities, status **open** (`RECEIVED_QTY = 0`, normal open PO), same `VENDOR_ID` and `LOCATION_ID` as the original.
  - **(b)** Set the new PO's `CUSTOM_FIELD1` = original PO reference; `CUSTOM_FIELD2` = receiver's ActiveOne employee code.
  - **(c)** **Close** the original PO (preserved, not deleted) so it no longer counts as incoming.
  - **(d)** Persist the delivery record and its New-Item child rows in our own DB tables.
- **FR-22** New PO line costs (Option A): ordered lines copy the original PO line's `RATE`; Not Ordered (existing) lines use `item.COST`; New Item lines use `0`. `AMOUNT` = `RATE × QUANTITY` per line; PO `AMOUNT` = sum.
- **FR-23** **New Items are never written to ActiveOne** (their `ITEM_ID` would not exist). They live only in our own delivery child table; only on-PO and Not-Ordered (real `item.ID`) lines are written to the ActiveOne PO.
- **FR-24** Zero-received ordered lines are **kept** on the new PO with `QUANTITY = 0` (not omitted).
- **FR-25** PO ID/CODE minting copies replenishment's convention (`MAX(ID)+1`, app-side `CODE` via `PO_CODE_PREFIX`). Any insert failure rolls back the whole transaction.

### Post-Save
- **FR-26** A success summary screen shows: the new PO number, a reference to the now-closed original PO, the final status breakdown, and a path back to the PO list.

### Masterlist Cache (admin)
- **FR-27** A backend table caches the ActiveOne item masterlist (`code`, `description`) — used to classify scans and supply Not-Ordered descriptions.
- **FR-28** `/admin` has a **Refresh item cache** button that re-pulls the masterlist and displays the count of items loaded.

## 6. Data Model

### Our own tables (new)

**`delivery`** — one row per committed receiving session.

| Field | Type | Notes |
|---|---|---|
| `id` | integer PK | |
| `original_po_id` | integer | ActiveOne PO superseded |
| `new_po_id` | integer | ActiveOne PO written |
| `new_po_code` | string | minted code (e.g. `OHPO-000123`) |
| `location_id` | integer | from the PO |
| `supplier_id` | integer | ActiveOne vendor contact ID |
| `received_by_user_id` | integer | app user who committed |
| `received_by_employee_code` | string | resolved ActiveOne type-2 contact code (CUSTOM_FIELD2) |
| `created_at` | datetime | |

**`delivery_new_items`** — child table for scanned SKUs absent from the masterlist (case c).

| Field | Type | Notes |
|---|---|---|
| `id` | integer PK | |
| `delivery_id` | integer FK → `delivery` | cascade delete |
| `code` | string | scanned barcode (`item.CODE` that did not resolve) |
| `description` | string | literal `"New Item"` |
| `quantity` | integer | received count |

**`item_master_cache`** — cached ActiveOne item list for scan classification.

| Field | Type | Notes |
|---|---|---|
| `code` | string PK | `item.CODE` |
| `description` | string | `item.DESCRIPTION` |
| `refreshed_at` | datetime | last admin refresh |

### ActiveOne tables (existing — write)

- **`purchase_order`** — new open PO written; original PO closed. Uses `CUSTOM_FIELD1` (original PO ref) and `CUSTOM_FIELD2` (receiver employee code).
- **`purchase_order_items`** — new PO lines for on-PO + Not-Ordered items only.
- **`contact`** — read: vendors (`TYPE = 3`) for names/lead time; employees (`TYPE = 2`) for receiver resolution.
- **`item`** — read: masterlist source for the cache, `COST` for Not-Ordered line rates.

### App user → employee link

The app user record must reference an ActiveOne type-2 contact (employee code). Managed in `/admin` user management (cross-module dependency). Save is blocked without it.

## 7. API Contract

All routes follow the resource-first convention under `/delivery`.

**`GET /delivery/api`** — list selectable open POs.
- Response: array of `{ poId, poCode, poDate, expectedDeliveryDate, supplierName, totalItems, totalQuantity }`. Excludes POs with `CUSTOM_FIELD1` set.

**`GET /delivery/api?poId={id}`** — load one PO for receiving.
- Response: `{ poId, poCode, supplierId, supplierName, locationId, lines: [{ itemId, code, description, orderedQuantity, unitSymbol }] }`.

**`POST /delivery/api`** — commit a delivery (supersede + close).
- Request: `{ poId, lines: [{ code, receivedQuantity }], newItems: [{ code, quantity }] }`.
- Server resolves receiver from the session user's linked employee, re-verifies the PO is still open, splits classification, writes the new PO, closes the original, persists our records — all atomic.
- Response (success): `{ newPoCode, closedOriginalPoCode, statusBreakdown: { exact, overServed, underServed, notOrdered, newItem } }`.
- Response (rejected): `{ error }` — e.g. PO already superseded (FR-20), or no linked employee (FR-19).

**`POST /admin/.../item-cache/refresh`** (within the admin module's API) — re-pull masterlist into `item_master_cache`.
- Response: `{ loadedCount }`.

> Admin password verification for manual edits (FR-12) reuses the existing credential-verification mechanism (requirement 1.3); each edit re-verifies.

## 8. UI/UX Flow

1. **Launcher → Delivery card** (visible to all roles).
2. **PO selection screen** — searchable card grid of open POs (all locations). Search by PO number. Tap a card to start.
3. **Receiving screen** —
   - Line list: item description · unit · ordered · received · status.
   - Scanner active by default; each scan increments and clears for the next.
   - Unmatched scans append Not-Ordered or New-Item lines live.
   - **Undo last scan** button (no auth). Any other quantity change prompts for admin password (per action).
   - Progress/summary visible (totals + status counts). State autosaved to localStorage.
   - **Review** advances to the review screen.
4. **Review screen** — full line list with ordered/received/status; header summary (supplier, total items, total quantity, status breakdown). Manual edits available under admin auth. **Save Delivery** commits.
5. **Save** — server re-checks PO is open, writes new PO + closes original atomically.
6. **Success summary** — new PO number, closed-original reference, final status breakdown, button back to PO list.
7. **Admin → item cache** — Refresh button shows loaded-item count.

## 9. Edge Cases & Error Handling

| Case | Handling |
|---|---|
| Concurrent receiving (PO superseded by another user mid-session) | Commit re-reads the original PO; if no longer open, reject with a clear "already received" message (FR-20). |
| User has no linked ActiveOne employee | Block save with an explanatory error (FR-19). |
| Scan resolves to item not on PO but in masterlist | Append as Not-Ordered line (FR-9b). |
| Scan resolves to unknown SKU | Append as New-Item line, description `"New Item"`, our-table-only (FR-9c). |
| Over-delivery | Allowed; line flagged Over Served (no block). |
| Ordered line never scanned | Stays Under Served; written to new PO with `QUANTITY = 0` (FR-24). |
| Mis-scan correction | Undo-last-scan (no auth) or admin-authorized manual edit. |
| Refresh / disconnect mid-session | State restored from localStorage (FR-14). |
| No open POs to show | Empty-state message on the selection screen. |
| Write-back failure (any line/PO insert) | Whole transaction rolls back; nothing committed; user retries (FR-25). |
| Duplicate ID/CODE collision with ActiveOne's own writer | UNIQUE on `CODE` + transaction makes it fail loudly and roll back rather than corrupt (see Open Questions). |

## 10. Open Questions

1. **`purchase_order.STATUS` value that means "closed."** Only `0` = open is known (assumed). Required to close the original PO. Verify against live ActiveOne data before production. Follow known values for now.
2. **ID/CODE minting concurrency.** `MAX(ID)+1` + app-side `CODE` is not safe against ActiveOne's own writer grabbing the same ID/CODE concurrently. Inherits replenishment's deferred open question #4 (real fix: read+bump `object_code_sequence` / `object_type_map`). UNIQUE on `CODE` + transaction = fail-loud for now.
3. **Receiver employee code resolution** — confirm which field on the ActiveOne type-2 contact is the "employee code" written to `CUSTOM_FIELD2`, and how the app-user→contact link is stored in user management.
4. **Masterlist cache scale** — confirm the full `item` masterlist is small enough to cache in one table refresh; revisit if the catalog is very large.

## 11. Out of Scope / Deferred

- **Enter Bill / stock posting** — performed manually by an admin in ActiveOne after the delivery PO is created. This app does **not** post `item_inventory`. *(Documented external dependency: until Enter Bill runs, the new PO stays open and its quantity correctly counts as incoming; Enter Bill then moves it to on-hand and closes the PO.)*
- **Admin-override audit log** — deferred to a future audit module (who authorized which manual edit, old→new value).
- **Delivery History** — separate module (requirement 2.4): searchable past deliveries, printable reports, search by Receiver/Date.
- **New Item creation/naming in ActiveOne** — downstream admin task; this module only captures code + `"New Item"`.
- **Full offline / Eyoyo buffered upload-later mode** — Phase 1 covers localStorage resilience and rapid-stream scan handling only.
- **Partial-receipt reconciliation** — not needed: ActiveOne has no receiving step today (PO → Enter Bill only), so `RECEIVED_QTY` is `0` on open POs until billed; this app is sole receiver.
- **Multi-PO / multi-location receiving sessions.**
