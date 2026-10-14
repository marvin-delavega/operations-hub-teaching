# PRD: History Module

Date: 2026-07-01

## 1. Overview

The History module is an **admin-only audit tool** that records and surfaces a durable, immutable trail of two kinds of committed work: **Replenishment runs** (PO-generation batches submitted from the replenishment module) and **Delivery sessions** (receiving sessions committed from the delivery module). Because ActiveOne's `purchase_order` table cannot express *why* an order looked the way it did (order period, rounding, sales-rate inputs, overrides) or the settings a receiving session ran under, the module persists an app-owned, self-contained snapshot at commit time. Admins open a record to see a fully sectioned summary reconstructing exactly what was submitted and the decision context behind it.

## 2. Goals

- Give admins a searchable, filterable history of every committed replenishment run and delivery session.
- Preserve the full **decision context** of each replenishment line (order period, rounding, sales rate, effective available, DOS, system-suggested qty vs. final qty, selling-area pooling breakdown, stockout dormancy fields) so a run is auditable long after submission.
- Preserve the full **line detail and mode settings** of each delivery session (ordered vs. received qty, line status, new items, blind-delivery / continuous-scanning settings, receiver).
- Make each record **self-contained and immutable** — readable even if the underlying ActiveOne entities are later renamed, edited, or removed.
- Support fast lookup by PO reference plus AND-combined filters (date range, location, supplier, created-by).

## 3. Non-Goals

- **No editing, deleting, or hiding** of history records — append-only, fully immutable. Corrections are deferred to a future iteration.
- **No staff access** — admin-only; no per-user "my history" scope.
- **No live/real-time reconciliation** against ActiveOne — the snapshot is the source of truth for history; it is not re-derived from live PO data on read.
- **No cross-module analytics/dashboards** — this is a record viewer, not a reporting/BI surface.
- Does **not** replace or alter the replenishment or delivery submission flows; it only adds a snapshot write within their existing atomic commits.

## 4. Users & Roles

- **Admin only.** `/history` and all sub-routes require `role === "admin"`, enforced in `middleware.ts` alongside the existing `/admin/*` gate. Non-admins are redirected to `/` exactly as with `/admin`.
- Staff who create runs/deliveries have their identity recorded (created-by / receiver) but cannot open the History module.

## 5. Functional Requirements

**Entry & navigation**
- FR-1: The home launcher's **History** card routes to `/history`, a **fork-choice screen** with two cards: *Replenishment History* and *Delivery History* (mirroring the module's original two-card fork pattern).
- FR-2: Each fork is its own screen with its own filtered list: `/history/replenishment` and `/history/delivery` (final sub-route naming per implementation, staying within the module route group).

**Listing & sorting**
- FR-3: Each sub-view loads the **most recent N records first** (newest-first), via pagination / infinite-scroll; it does **not** load the full table at once and applies **no** default date window.
- FR-4: A **Replenishment** list row shows: date/time (Manila), location, **number of suppliers** (count only, for consistent card height), created-by, path tag (Standard / Stockout), and a count summary (e.g. "3 POs / 42 lines").
- FR-5: A **Delivery** list row shows: date/time (Manila), location, supplier (vendor name), receiver, and **both** PO references (original → new superseding).

**Search & filters**
- FR-6: A **reference-number search** matches **partial/contains** against PO codes. For replenishment it matches any constituent PO code and surfaces the containing run. For delivery it matches **both** the original and the new superseding PO code.
- FR-7: Both sub-views expose filters: **date range**, **location**, **supplier**, and **created-by**.
- FR-8: The search term and all active filters combine with **AND** — a record must satisfy the search term *and* every active filter to appear.
- FR-9: Supplier filter semantics: a replenishment run matches if it **includes** the selected supplier; a delivery matches on its single vendor.
- FR-10: Date-range filter boundaries are evaluated in **Asia/Manila**.

**Replenishment summary (opened record)**
- FR-11: Standard and Stockout runs appear **together** in one combined list; each record is a single selectable item tagged with its path.
- FR-12: The summary shows a **run-level header**: date/time (Manila), location, created-by, path tag, rounding setting, and — for Standard runs — the **From–To sales range** used.
- FR-13: Below the header, the summary is **sectioned one section per ActiveOne PO**, grouped supplier → manufacturer (matching how the run split), each section showing its **PO code** and its line rows.
- FR-14: Each line row is a **full decision snapshot**: item, unit (symbol), sales rate, selling-area demand breakout (with area name), effective available, DOS, **system-suggested qty**, **final submitted qty**, the line's **own order period**, and rounding direction.
- FR-15: Lines where **final ≠ system-suggested** are visually **highlighted as overridden**.
- FR-16: For **Stockout** runs, the snapshot additionally preserves the stockout-specific fields — last-sold date, 30-day daily rate, window units sold, dormancy context — displayed in that record's summary. Standard-only fields (e.g. From–To range, live DOS from a range) are absent/null for stockout runs.

**Delivery summary (opened record)**
- FR-17: The summary shows a header: date/time (Manila), location, vendor, receiver, both PO refs (original → new), and the **mode settings** the session ran under (**blind delivery**, continuous scanning).
- FR-18: The summary shows **per-line ordered qty vs. received qty** with each line's **status** (Exact / Over-Served / Under-Served / Not-Ordered / New Item).
- FR-19: The summary shows a **New Items** section listing unknown SKUs (code + "New Item"), preserved as captured.

**Snapshot capture (write path)**
- FR-20: On a successful replenishment submission, the app persists a run snapshot (run header + all per-line decision snapshots + constituent PO codes) **inside the same atomic transaction** that writes the PO(s) to ActiveOne. Any failure rolls back both the POs and the snapshot together.
- FR-21: On a successful delivery save, the app persists a delivery snapshot (session header + mode settings + all per-line ordered/received/status detail + new items) **inside the same atomic transaction** as the delivery commit.
- FR-22: Snapshots store **human-readable labels** alongside IDs — location name, supplier name, manufacturer name, item description, unit symbol, created-by/receiver display name — so records stay readable if the source entity is later renamed or removed.
- FR-23: History records are **immutable**: no update or delete path exists in the API or UI for any role.

**Export**
- FR-24: An opened summary (either fork) can be **printed** and **exported to CSV** (line rows) for offline/external audit.

## 6. Data Model

App-owned tables (created via the idempotent `create-app-tables.sql` pattern; **never** ActiveOne tables). Owned by the `history` module conceptually, but written by the `replenishment` and `delivery` modules at commit time.

### Replenishment run (header)
| Field | Type | Notes |
|---|---|---|
| id | integer PK | app run reference |
| path | enum('standard','stockout') | discriminator |
| location_id | integer | ActiveOne location ID |
| location_name | text | snapshot label |
| created_by_user_id | integer | FK-style ref to `users` |
| created_by_name | text | snapshot display name |
| rounding | enum('up','down') | run-level toggle |
| sales_range_from | date nullable | Standard only |
| sales_range_to | date nullable | Standard only |
| supplier_count | integer | denormalized for list row |
| po_count | integer | denormalized for list row |
| line_count | integer | denormalized for list row |
| created_at | datetime | commit time (stored/derived UTC; displayed Manila) |

### Replenishment run PO (section)
| Field | Type | Notes |
|---|---|---|
| id | integer PK | |
| run_id | integer | FK → run header |
| po_code | varchar | ActiveOne `purchase_order` CODE; searchable |
| supplier_id | integer | |
| supplier_name | text | snapshot label |
| manufacturer_id | integer nullable | null = "No Brand" |
| manufacturer_name | text nullable | snapshot label |

### Replenishment run line (per-line snapshot — single table, path-discriminated)
| Field | Type | Notes |
|---|---|---|
| id | integer PK | |
| run_po_id | integer | FK → run PO |
| item_id | integer | |
| item_description | text | snapshot label |
| unit_symbol | varchar | purchase unit symbol |
| order_period_days | integer | per-line (7/14/30) |
| sales_rate | decimal | combined rate (purchase units) |
| selling_area_demand | decimal nullable | shelf breakout portion |
| selling_area_names | text nullable | tooltip source |
| effective_available | decimal nullable | Standard |
| dos | decimal nullable | Standard |
| suggested_qty | integer | system suggestion |
| final_qty | integer | submitted qty (override if ≠ suggested) |
| last_sold_date | date nullable | Stockout |
| stockout_daily_rate | decimal nullable | Stockout 30-day rate |
| stockout_window_units | decimal nullable | Stockout window base units |
| created_at | datetime | |

### Delivery session (header)
Extends / complements the existing `delivery` table (one row per committed session). New durable fields captured for history:
| Field | Type | Notes |
|---|---|---|
| id | integer PK | existing |
| location_id / location_name | integer / text | snapshot |
| vendor_id / vendor_name | integer / text | supplier snapshot |
| original_po_code | varchar | searchable |
| new_po_code | varchar | superseding PO; searchable |
| received_by_user_id | integer | existing |
| receiver_name | text | snapshot display name |
| blind_delivery | boolean | mode setting |
| continuous_scanning | boolean | mode setting |
| created_at | datetime | existing |

### Delivery session line (per-line snapshot)
| Field | Type | Notes |
|---|---|---|
| id | integer PK | |
| delivery_id | integer | FK → delivery header |
| item_code | varchar | |
| item_description | text | snapshot label |
| ordered_qty | integer | from original PO |
| received_qty | integer | scanned/received |
| status | enum('exact','over','under','not_ordered','new_item') | classification |

### Delivery new items
Reuses existing `delivery_new_items` child (code + literal "New Item").

**Indexing:** each header table is indexed on the admin filter/sort columns — `created_at`, `location_id`, supplier/vendor id, `created_by_user_id` — and PO-code columns for search.

## 7. API Contract

All endpoints under the history module route group; all require an **admin** session.

- `GET /history/replenishment/api` — list replenishment runs.
  - Query: `q` (partial PO code), `from`, `to` (Manila dates), `locationId`, `supplierId`, `createdBy`, `cursor`/`page`, `limit`.
  - Response: page of run summaries (list-row fields per FR-4) + next cursor. AND-combined filters.
- `GET /history/replenishment/api/{runId}` — full run snapshot: header (FR-12) + PO sections (FR-13) + line snapshots (FR-14/16).
- `GET /history/delivery/api` — list delivery sessions.
  - Query: `q` (partial PO code, matches original **or** new), `from`, `to`, `locationId`, `supplierId`, `createdBy`, `cursor`/`page`, `limit`.
  - Response: page of delivery summaries (list-row fields per FR-5) + next cursor.
- `GET /history/delivery/api/{deliveryId}` — full delivery snapshot: header + mode settings (FR-17) + line detail (FR-18) + new items (FR-19).
- **Export**: CSV is produced from the same detail response (client-side render or a `?format=csv` variant of the detail GET); print uses the rendered summary.

All history endpoints are **query-only (GET)**. There is **no** create/update/delete endpoint in this module — snapshot writes happen inside the replenishment and delivery submission use cases, not here (Command-Query Separation preserved).

## 8. UI/UX Flow

1. **Home → History card** → `/history` fork-choice screen (two cards: Replenishment History, Delivery History).
2. **Select a fork** → filtered list screen. On load: newest-first page of records (no date default). Filter bar: reference search box + date range + location + supplier + created-by. Results update on AND-combined criteria; infinite-scroll / pagination for more.
3. **Tap a record** → summary screen.
   - **Replenishment summary**: run-level header (date, location, created-by, path tag, rounding, and From–To range for Standard) → sections per PO (supplier → manufacturer, PO code) → per-line snapshot rows, with overridden lines highlighted; stockout records show dormancy fields instead of range/DOS context.
   - **Delivery summary**: header (date, location, vendor, receiver, original → new PO, blind-delivery + continuous-scanning settings) → per-line ordered vs. received with status badges → New Items section.
4. **Export / Print** action on the summary screen (print + CSV of line rows).
5. All timestamps render in **Asia/Manila**.

## 9. Edge Cases & Error Handling

- **Non-admin access** to any `/history` route → redirect to `/` (middleware), consistent with `/admin`.
- **No records / no results after filtering** → empty-state message; not an error.
- **Renamed/removed ActiveOne entity** (location, supplier, manufacturer, item) → history still displays the **snapshot label** captured at commit; never blanks out or errors.
- **Partial submission failure** (replenishment atomic per supplier×manufacturer, delivery atomic per session) → the snapshot write is inside the same transaction, so **no** history record is created for a rolled-back submission.
- **Mixed order periods in one run** → handled natively: order period lives per line, so the summary shows each line's actual period.
- **Stockout run** → range/DOS fields null; dormancy fields populated; renders in the same combined list, path-tagged.
- **Delivery with new items only / zero ordered lines** → New Items section populated; ordered/received rows reflect zeros where applicable.
- **Duplicate/partial PO-code search** → partial contains match; multiple runs/deliveries may return; all shown.
- **Large history / performance** → pagination + indexed filter columns keep queries bounded on Android tablets.

## 10. Open Questions

- **Export format polish**: confirm CSV column set and whether print should be a styled print stylesheet vs. a generated PDF. (Spec assumes print + CSV of line rows; PDF deferred.)
- **Created-by filter source**: list **all** users vs. only users who appear in history. (Leaning: only those present in history, to keep the picker relevant.)
- **Sub-route naming** for the two forks within the module route group (final path segments).
- Whether a delivery that is **re-received / superseded again** should visibly **chain** to its prior delivery record (raised, deferred).

## 11. Out of Scope / Deferred

- Editing/deleting/correcting history records (correction workflow deferred entirely).
- Staff access and per-user "my history" scoping.
- Cross-record analytics, dashboards, or exports beyond a single record.
- PDF generation (print + CSV only for now).
- Delivery re-receive chaining/linking across superseding events.
- Live reconciliation of snapshots against current ActiveOne data.
