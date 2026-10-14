# UAT — Replenishment Module & Connected Surfaces

**App:** Operations Hub · **Module:** Replenishment (+ supplier/location/manufacturer selection, history, related admin tabs)
**Reference PRDs:** PRD-stockout-replenishment, PRD-replenishment-per-piece-ordering, PRD-replenishment-supplier-minimum-order, PRD-replenishment-worksheet, PRD-replenishment-selling-area-demand-pooling, PRD-replenishment-manufacturer-selection, PRD-sales-offtake-rollup, PRD-history-module, PRD-replenishment-history-printable-report, PRD-supplier-order-scheduling, PRD-role-based-access-control

---

## 1. Scope

In scope:

- Entry points (home launcher card, due-today badge, permission gating)
- Selection chain: `/location` → `/supplier` → `/manufacturer` → `/replenishment`
- Standard path: run screen, grouping, header controls, calculations, unit-of-measure display
- Selling-area demand pooling
- Per-piece ordering (Review toggle)
- Per-supplier minimum order (advisory indicator + confirm)
- Replenishment Worksheet (printable pre-order)
- PO flow: Generate PO → Review → Submit (atomic split by supplier+manufacturer)
- Stockout path
- History module: replenishment history list, detail snapshot, search/filters, CSV export, printable audit report
- Admin surfaces feeding replenishment: Order Scheduling (Kanban), Order Pooling tab, sales-rollup health panel
- Off-take rollup (`item_sales_daily`): nightly refresh trigger, self-heal, backfill parity

Out of scope: delivery, counting, invoice, transfer modules; first-run wizard (covered separately); ActiveOne-side Enter Bill process.

## 2. Prerequisites

### 2.1 Environment

| # | Item |
|---|---|
| ENV-1 | App running (`npm run dev`, http://localhost:3000) with a reachable MySQL DB configured via `/connect` or `.env.local` |
| ENV-2 | ActiveOne ERP database accessible (same MySQL instance) with realistic `item`, `Contact`, `purchase_order*`, `invoice*`, `sales_receipt*` data |
| ENV-3 | Device/browser: Android tablet or Chrome DevTools mobile viewport (~48px touch targets verified) |
| ENV-4 | Bluetooth scanner (Eyoyo) available for any scan-dependent flows (replenishment is keyboard-driven; scanner optional here) |

### 2.2 Test accounts & roles

| Account | Roles/permissions needed | Purpose |
|---|---|---|
| Admin A | Administrator (all permissions) | Full-flow testing |
| Staff S1 | Open Replenishment only | Permission-gate checks |
| Staff S2 | No permissions | Empty launcher state |

### 2.3 Test data setup

| # | Item |
|---|---|
| DATA-1 | ≥ 3 suppliers: one weekly-scheduled (due today/tomorrow), one monthly, one unscheduled; at least one with `Contact.CUSTOM_FIELD3` lead time set, one without |
| DATA-2 | Items per supplier spanning multiple manufacturers, incl. items with `MANUFACTURER_ID = NULL` ("No Brand") |
| DATA-3 | At least one item whose purchase unit ≠ base unit (factor > 1) and has a `unit_of_measure.SYMBOL` |
| DATA-4 | Sales history in last 30 days for some items; zero-sale items for others |
| DATA-5 | An open PO with undelivered qty (incoming stock) for at least one item |
| DATA-6 | A feeder warehouse + mapped selling area configured in Admin → Order Pooling (for §8) |
| DATA-7 | A committed replenishment run exists (for §12) — produced by this UAT itself |

## 3. Entry Points & Access Control

| ID | Scenario | Steps | Expected |
|---|---|---|---|
| EP-01 | Launcher card visible with permission | Log in as Admin A | Replenishment card shown on `/`; badge shows count of suppliers due today (next order date ≤ today, excl. unscheduled) |
| EP-02 | Badge count correct | Compare badge vs suppliers due today on `/supplier` | Counts match; computed on read (change a schedule in DB → refresh home → badge updates without cache) |
| EP-03 | Card hidden without permission | Log in as Staff S2 (no perms) | Card absent; "No modules assigned" empty state if no other modules |
| EP-04 | Unauthenticated deep link | Visit `/replenishment?...` while logged out | Redirected to `/login` |
| EP-05 | Direct URL without permission | As Staff S1, navigate directly to `/history` | Redirected to `/` (no View History permission) |

## 4. Selection Chain

### 4.1 Location (`/location?module=replenishment&returnTo=…`)

| ID | Scenario | Steps | Expected |
|---|---|---|---|
| LC-01 | Visible locations listed | Open chain from Replenishment card | Locations from ActiveOne shown as tiles; hidden ones (per `module_location_visibility`) excluded |
| LC-02 | "Show all locations" | Toggle reveal hidden ones | Hidden tiles appear muted; selecting one still works |
| LC-03 | Selling areas disabled for replenishment | View while `module=replenishment` | Configured selling areas grayed out with "Fed by {feeder}" note; not tappable |
| LC-04 | Selling areas selectable elsewhere | (Spot-check) open `/location` from a non-replenishment module | Selling areas enabled |
| LC-05 | Selection navigates onward | Tap a location | Lands on `/supplier?returnTo=…&locationId={id}` |

### 4.2 Supplier (`/supplier`)

| ID | Scenario | Steps | Expected |
|---|---|---|---|
| SU-01 | Due sections | Observe grouping | Three labeled sections: **Due Today** (next order ≤ today, incl. overdue), **Due Tomorrow**, **Others** |
| SU-02 | Sorting | Inspect order | Due Today: most-overdue first then alphabetical; Due Tomorrow & Others alphabetical |
| SU-03 | Tile annotation | Inspect tiles | Scheduled suppliers show "Next order: [date]"; unscheduled show no annotation line |
| SU-04 | Multi-select | Tap several tiles | Selected tile gets full-tile accent border + tinted bg + corner check; tap again deselects |
| SU-05 | Search keeps selection | Select suppliers → search by name | Filtered-out selected tiles leave view but stay selected; Continue count unchanged |
| SU-06 | Continue guard | With 0 selected | "Continue (N selected)" disabled |
| SU-07 | Pre-select via param | Return with existing `supplierIds` | Those suppliers arrive pre-selected |
| SU-08 | Continue navigates | Continue with N≥1 | Lands on `/manufacturer?…&supplierIds={list}` (chain continues to manufacturer step per PRD-replenishment-manufacturer-selection) |

### 4.3 Manufacturer (`/manufacturer`)

| ID | Scenario | Steps | Expected |
|---|---|---|---|
| MF-01 | Grouping per supplier | Observe list | Manufacturers grouped under each selected supplier; "No Brand" first, then alphabetical |
| MF-02 | Source correctness | Cross-check against ActiveOne `item.PREFERRED_VENDOR_ID IN (selected)` ∪ `manufacturer` table | Only manufacturers carried by the selected suppliers' active items appear |
| MF-03 | All checked by default | Load page fresh | Every manufacturer checked; global select-all/clear-all works; per-supplier tri-state reflects partial states |
| MF-04 | Name search | Type partial name | Filters across groups |
| MF-05 | Omit when all selected | Deselect one → reselect all → Continue | URL omits `manufacturerIds` entirely (= all, backward-compatible) |
| MF-06 | Partial selection encoding | Deselect some → Continue | `manufacturerIds` = comma-separated `{supplierId}:{manufacturerId|nb}` tokens |
| MF-07 | Params preserved | Note `locationId` before/after Continue | Preserved in final run URL |
| MF-08 | Missing params error | Open `/manufacturer` without `supplierIds` | In-place error shown (not a crash) |
| MF-09 | Final landing | Complete chain | `/replenishment?locationId=…&supplierIds=…&manufacturerIds=…` |

## 5. Standard Run Screen

> All dates/times in these tests are **Asia/Manila (UTC+8)**.

| ID | Scenario | Steps | Expected |
|---|---|---|---|
| ST-01 | Grouping | Observe main list | Items grouped by supplier (collapsible), sub-grouped by manufacturer |
| ST-02 | Header content | Inspect a supplier header | Name · item count · aggregate critical badge · "Due" tag if next order date is today/tomorrow · tri-state checkbox |
| ST-03 | Manufacturer header | Inspect | Checkbox · name · count · per-manufacturer critical badge · order-period selector (7/14/30) |
| ST-04 | Sort order | Inspect items | Alphabetical by description within manufacturer; "No Brand" pinned first |
| ST-05 | Collapse independence | Collapse a supplier, then a manufacturer inside another | Both levels collapse independently |
| ST-06 | Expand/Collapse All | Use global control | Affects both supplier and manufacturer levels |
| ST-07 | Checkboxes default | Load fresh run | All checkboxes (supplier tri-state, manufacturer, item) default checked |
| ST-08 | Filtering scope | Verify items listed | Only items where `suggested_order > 0` for the group's order period; sales-rate-0 items excluded; filtered to exact (supplier, manufacturer) pairs selected |
| ST-09 | Header controls | Adjust From/To date range, order period, rounding toggle | Date range changes rate window; period selector re-filters/recalculates affected sub-group immediately; rounding up/down changes suggested qtys |
| ST-10 | Unit column | Find an item with purchase unit ≠ base | "Unit" column right after item name shows `unit_of_measure.SYMBOL` (e.g. "cs"); qty columns plain numbers |
| ST-11 | Conversion math | Pick an item with known raw base-unit sales | Rate/DOS/suggestion computed after converting to purchase units (base ÷ factor); DOS formula unchanged by factor |
| ST-12 | Rounding applied post-conversion | Toggle round down/up | Whole purchase units after conversion |
| ST-13 | Critical flag | Find item with DOS < supplier lead time | Item flagged critical (uses `critical` token styling) |
| ST-14 | "<1 cs" surfacing | Set rounding **down**; find item with unrounded suggestion > 0 but rounds to 0 | Item surfaces with "<1 cs" badge, **default unchecked** |
| ST-15 | DOS column | Inspect | DOS present as a column (effective_available ÷ daily_sales_rate) |
| ST-16 | Effective available | Pick item with an open undelivered PO | effective = on_hand + incoming (undelivered qty across ALL open POs, any origin) |
| ST-17 | Suggestion formula | Hand-calculate for one item | `max(0, rate × (order_period + lead_time) − effective_available)` with chosen rounding |
| ST-18 | Rate denominator | Change From/To span | Denominator = full calendar span of range, never count of days with sales rows |

## 6. Selling-Area Demand Pooling

> Requires DATA-6 mapping.

| ID | Scenario | Steps | Expected |
|---|---|---|---|
| PL-01 | Combined rate | Inspect feeder's items | "Sales rate" column shows combined (feeder + mapped selling areas) rate |
| PL-02 | Demand breakout | Look right of sales-rate column | Selling-area demand column shows shelf portion in purchase units; tooltip names the area |
| PL-03 | Shelf-only SKU surfaces | Feeder rate 0, selling-area rate > 0 | Item still appears in feeder's run (supplier-scoped) |
| PL-04 | Effective available stays feeder's | Check item stocked only in selling area | Available excludes selling-area on-hand |
| PL-05 | DOS/critical/suggestion use combined rate | Hand-check one pooled item | Computed from combined rate |
| PL-06 | No mappings = no change | Temporarily remove mapping (or use unmapped feeder) | Behaves exactly like pre-pooling baseline |

## 7. Per-Piece Ordering & Per-Supplier Minimums (Review step)

| ID | Scenario | Steps | Expected |
|---|---|---|---|
| PP-01 | Toggle visibility | Enter Review | Per-line case⇄pieces toggle visible only where purchase unit ≠ base (factor 1 lines hide it) |
| PP-02 | Switch to pieces | Toggle a line to pieces | Suggestion recomputed in base units, **always round-up**, ignoring the run's rounding toggle |
| PP-03 | Mixed PO | Toggle some lines to pieces, submit PO | One PO may mix case + piece lines; piece lines written with `UNIT_ID = BASE_UNIT_ID`, `UNIT_BASE_QUANTITY = 1`, `RATE = COST` |
| PP-04 | Draft persistence | Toggle pieces, reload/re-enter Review | Toggle persisted in the run's localStorage draft |
| PP-05 | Run-time only | Check `/admin` | No persisted/config flag for per-piece anywhere |
| MO-01 | Min indicator | On a supplier with minimums set, drop below threshold | Indicator appears on supplier header (main list + Review), `warning` token, hidden when unset or met |
| MO-02 | Advisory confirm | Submit with per-supplier total below either minimum | Non-blocking confirm dialog; thresholds + acknowledgment recorded in run history |
| MO-03 | Sum across split | Supplier split into multiple manufacturer POs totaling below min | Confirm triggers based on **per-supplier total**, not per-PO |
| MO-04 | Server advisory only | Force-submit below minimum | Submission succeeds (no server gate) |

## 8. Replenishment Worksheet

| ID | Scenario | Steps | Expected |
|---|---|---|---|
| WS-01 | Availability | On Standard tab, before Generate PO | Worksheet action available to any `module.replenishment` user |
| WS-02 | Full catalog mode | Trigger worksheet fetch | Uses `GET /replenishment/api?worksheet=true`; lists **all active items** for selected suppliers including 0-qty and zero-sales items inline |
| WS-03 | Blank Order Qty | Inspect print preview | Blank **Order Qty** column for paper annotation |
| WS-04 | Layout | Print preview | Portrait, **new page per supplier**, monochrome-safe |
| WS-05 | 0-qty marker | Inspect 0-suggestion rows | Typographic marker present (never color-only) |
| WS-06 | Ephemeral | Print/close worksheet, check History | **No** history record created by worksheet alone |

## 9. PO Flow — Generate → Review → Submit

| ID | Scenario | Steps | Expected |
|---|---|---|---|
| PF-01 | Generate PO | Uncheck some lines, adjust nothing, Generate | Review screen opens grouped supplier → manufacturer |
| PF-02 | Qty overrides | Override a per-item qty | Value accepted as positive whole number; final-vs-system tracked |
| PF-03 | Submit atomicity | Submit multi-supplier/multi-manufacturer run | POs split one-per (supplier, manufacturer) combination; **any failure rolls back all** |
| PF-04 | PO write-back | Open created POs in ActiveOne | `CUSTOM_FIELD3` = manufacturer name for named POs, NULL for "No Brand"; `UNIT_ID` = purchases (or base) unit; `UNIT_BASE_QUANTITY` = resolved factor; qty in purchase units; never factor 1 unless truly base |
| PF-05 | ID/CODE minting | Inspect new PO IDs/CODEs | `MAX(ID)+1` app-side; CODE per `PO_CODE_PREFIX` convention |
| PF-06 | `last_ordered_at` write-back | Check `supplier_schedule` after submit | Updated for **every** submitted supplier (all schedule types); record auto-created (`lead_time` type) if absent |
| PF-07 | Success summary | Observe post-submit screen | Grouped by supplier, one row per manufacturer PO |
| PF-08 | Command-query separation | Re-run GET endpoints after submit | Reads unchanged except through intended writes; no side effects from GETs |
| PF-09 | Resubmit guard | Refresh/back after success | No duplicate submission from stale screen |

## 10. Stockout Path

| ID | Scenario | Steps | Expected |
|---|---|---|---|
| SO-01 | Tab toggle | Open `/replenishment` | Standard/Stockout tab toggle on same screen; no separate fork route |
| SO-02 | Scoping | Switch to Stockout | Location-only scope (no supplier step); results still **grouped by supplier**; query filters `PREFERRED_VENDOR_ID IN (supplierIds)` when arriving via chain |
| SO-03 | Gate | Inspect surfaced items | Effective available = 0 **and** ≥ 1 sale in ~13-month rollup; never-sold items excluded |
| SO-04 | Dormancy context | Inspect columns | Last-sold date, 30-day rate, window units, unit, suggested qty (no DOS/critical) |
| SO-05 | Demand model | Hand-check one item | Window = fixed 30 days ending at most recent sale; `daily_rate = window base units ÷ 30` (divisor always 30) |
| SO-06 | Suggestion | Hand-check | `round(rate × (order_period + lead_time))`; missing `CUSTOM_FIELD3` → lead time 0; only `suggested_order > 0` surface |
| SO-07 | Headers | Inspect supplier headers | No critical/Due badges |
| SO-08 | Defaults | Load fresh | All checkboxes default **unchecked** |
| SO-09 | Sort | Inspect order | Alphabetical by description, "No Brand" first |
| SO-10 | PO flow reuse | Run full Generate → Review → Submit | Identical two-step flow, atomic split, `CUSTOM_FIELD3` write, `last_ordered_at` write-back; **no** special tag distinguishing stockout POs |

## 11. Rollup & Self-Heal

| ID | Scenario | Steps | Expected |
|---|---|---|---|
| RU-01 | Nightly refresh endpoint | POST refresh endpoint with valid shared-secret token (via Task Scheduler `.bat` or curl) | Trailing 7-day window recomputed for **all locations**; idempotent on composite key (run twice → same rows) |
| RU-02 | Auth gate | POST without/with wrong token | Rejected (401/403) |
| RU-03 | Self-heal missing days | Delete a recent rollup day from `item_sales_daily`, load replenishment | Day computed live then persisted; both directions covered; selling-area days included |
| RU-04 | Grain correctness | Spot-check a `(location, item, date)` row | Summed base units (`QUANTITY × COALESCE(UNIT_BASE_QUANTITY,1)`) across invoices AND sales receipts; source filters match spec (`STATUS NOT IN (0,6,7)`; receipts also `RETURN_TRX=0`, non-void) |
| RU-05 | Admin health panel | Open `/admin` rollup panel | Shows last refresh, covered range, row/item counts; manual **full rebuild** and **refresh-now** buttons work |
| RU-06 | Backfill parity | (One-time) run deploy backfill script chunked over 13 months | Parity check vs live CTE passes before rollup trusted |

## 12. History Module (Replenishment)

| ID | Scenario | Steps | Expected |
|---|---|---|---|
| HI-01 | Fork choice | `/history` home | Fork-choice screen: Replenishment History vs Delivery History |
| HI-02 | Combined list | Open Replenishment History | Standard + Stockout in **one** list, path-tagged; newest first; paginated |
| HI-03 | Snapshot completeness | Open a run detail | Decision snapshot per line: order period, rounding, sales rate, selling-area demand breakout, effective available, DOS, system-suggested vs final qty (**overrides highlighted**); stockout dormancy fields for stockout runs |
| HI-04 | Human-readable labels | Rename an item/supplier in ActiveOne, reopen old record | Labels survive renames (self-contained snapshot) |
| HI-05 | Summary sectioning | Inspect summary | Sectioned per ActiveOne PO; row shows supplier **count**, not names |
| HI-06 | Minimum-order record | Open run submitted under MO-02 | Override acknowledgment + thresholds recorded |
| HI-07 | Reference search | Partial PO-code search | Contains-match on any constituent PO; combines AND with date range, location, supplier, created-by filters |
| HI-08 | Manila timezone | Compare timestamps/filters vs wall clock | All timestamps + date-filter boundaries Asia/Manila |
| HI-09 | Read-only | Attempt edit/delete anywhere | None offered; GET-only module |
| HI-10 | Same-transaction write | (Verify during PF-03 failure rollback) | History snapshot rolls back with PO commit — no orphan history rows |
| HI-11 | CSV export | Export current filtered view | Line-row CSV downloads matching on-screen data |
| HI-12 | Printable report | Print run detail | Landscape `@media print`: document header, per-PO Final-Qty subtotals + grand total, repeated running header, Page X of Y / run-ref footer, no row splits, repeated table headers, monochrome-safe override markers, app chrome hidden |

## 13. Admin Surfaces Feeding Replenishment

| ID | Scenario | Steps | Expected |
|---|---|---|---|
| AD-01 | Order Scheduling Kanban | Open `/admin` Order Scheduling tab | Weekly / Monthly / Lead-time columns; drag assigns; Weekly prompts weekday; Monthly prompts day 1–31 clamped to month length |
| AD-02 | Kanban cancel/search | Drag then cancel; type in search | Cancel snaps back; search filters across columns; persists on confirm |
| AD-03 | Schedule effect | Set supplier due tomorrow → check `/supplier` + home badge | Appears under Due Tomorrow; badge updates |
| AD-04 | Minimums editing | Set ₱ and/or qty minimum on `supplier_schedule` | Persisted; reflected per MO-01 |
| AD-05 | Order Pooling validation | Try self-feed, dual role, chain | Each blocked with clear message; selling-area-centric editing, feeder-grouped display |
| AD-06 | Pooling applies next run | Save mapping mid-session | Existing open run unaffected; computed on read applies to next run/load |
| AD-07 | Permission gating | As staff without admin-tab permissions, visit `/admin` | Blocked; each tab gated by its own permission |

## 14. Regression Sanity

| ID | Scenario | Expected |
|---|---|---|
| RG-01 | Full happy path end-to-end | Login → home → location → supplier → manufacturer → standard run → generate → review (incl. one per-piece toggle, one override) → submit → history shows run with all snapshot fields → CSV + print OK |
| RG-02 | Stockout end-to-end | Login → stockout tab → run → submit → history tagged stockout with dormancy fields |
| RG-03 | Session/theme sanity | Theme toggle persists; account menu works; sign-out returns to `/login`; 24h idle-window focus recheck doesn't fire spuriously during testing |

---

## Sign-off

| Role | Name | Date | Result (Pass/Fail) | Notes |
|---|---|---|---|---|
| Product owner | | | | |
| Warehouse ops (Standard) | | | | |
| Warehouse ops (Stockout) | | | | |
| Administrator | | | | |
