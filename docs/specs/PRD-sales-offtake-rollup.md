# PRD: Sales Off-take Rollup (`item_sales_daily`)
Date: 2026-06-27

## 1. Overview
Replenishment's sales-rate calculation currently scans raw POS data live on every run. On the busiest location (the selling area, loc 49) this means aggregating ~1M+ sale lines per month, making the `sold` CTE take ~7s and the full replenishment query ~11–14s. This feature introduces an app-owned, pre-aggregated daily off-take table, `item_sales_daily`, that collapses the heavy sales scan into a small summed-per-day table. Replenishment reads this rollup instead of scanning raw `invoice_items` / `sales_receipt_items`, turning the ~7s sales portion into milliseconds. It is the first step of a broader replenishment pre-aggregation effort (on-hand snapshot deferred) and is deliberately designed so additional rollups slot into the same pattern later.

## 2. Goals
- Replace the live `sold` CTE in replenishment with a read against a pre-aggregated daily rollup, eliminating the ~7s sales scan on the selling area.
- Cover **both** off-take sources (`invoice_items` and `sales_receipt_items`) so the rollup is a true drop-in for the entire existing `sold` CTE with no correctness gap on any location.
- Keep off-take data fresh automatically (nightly), without depending on a human remembering to refresh.
- Self-heal any missed refresh on read, so a skipped night never silently corrupts the sales rate.
- Ship a deploy-time backfill so clients can run replenishment over past months immediately, on day one.
- Preserve current behavior exactly — same filters, same base-unit measure, same downstream unit conversion and DOS math.
- Be architected so a future on-hand (and any other) rollup can be added using the same pattern.

## 3. Non-Goals
- **Does not** roll up on-hand inventory (the ~2.7s `item_inventory` ledger collapse stays live for now — deferred to a later iteration).
- **Does not** change the sales-rate, DOS, suggestion, or unit-conversion formulas. Unit conversion to purchase units and DOS still happen live downstream.
- **Does not** store a per-source (invoice vs sales-receipt) breakdown, or any grain finer than one summed total per item per location per day.
- **Does not** add an ORM, an HTTP API to ActiveOne, or indexes on ActiveOne's raw tables.
- **Does not** introduce a managed-platform cron or an in-process timer — the trigger is an external OS scheduler hitting a protected endpoint.
- **Does not** promote the rollup to `app/shared/` — no other module needs off-take.
- **Does not** re-interpret sale dates through a timezone; it buckets on the raw source `DATE` exactly as the current CTE does.

## 4. Users & Roles
- **Replenishment users (admin + staff):** consume the rollup transparently via the existing replenishment screen — no new interaction; the screen is simply faster.
- **Admins:** access a lightweight rollup-health panel under `/admin` (read-only metrics + manual rebuild / refresh-window actions). Admin-only, behind the existing `role === "admin"` guard.
- **The server / OS scheduler (machine identity):** calls the protected nightly refresh endpoint using a shared-secret token — not a user session.
- **Operator running deploy scripts:** runs the one-shot backfill script and the scheduler-registration `.bat` on the server.

## 5. Functional Requirements

**Rollup data & grain**
- **FR-1:** The rollup stores one row per `(location_id, item_id, sale_date)` holding the **summed base units sold** for that day, where base units = `QUANTITY × COALESCE(UNIT_BASE_QUANTITY, 1)`, summed across both `invoice_items` and `sales_receipt_items`.
- **FR-2:** Source rows are included/excluded using the **exact same filters** as the current live `sold` CTE: invoices/receipts with `STATUS NOT IN (0, 6, 7)`; sales receipts additionally require `COALESCE(RETURN_TRX, 0) = 0` and `VOID_REFERENCE_NO IS NULL`; sale day is the raw source `DATE` column (no timezone re-interpretation).
- **FR-3:** Days on which an item had no qualifying sales produce **no row** (the table is sparse).

**Reading the rollup (replenishment)**
- **FR-4:** Replenishment's off-take figure for an item over a From/To window is the **sum of `units_sold` across rollup rows** in that window for the run's `location_id`, replacing the raw `sold` CTE.
- **FR-5:** The sales-rate denominator remains the **full calendar span** of the requested range (`days_in_range`), never the count of rollup rows present (R1).
- **FR-6:** Downstream behavior is unchanged: base-unit totals are converted to purchase units and DOS/suggestion computed live exactly as today.

**Nightly refresh**
- **FR-7:** A protected refresh endpoint, when invoked, **recomputes a trailing 7-day window** (today back 7 days) for **all locations**, overwriting those days' rows from source, so recent voids/returns/edits are absorbed. Older history is left frozen.
- **FR-8:** The refresh endpoint requires a valid **shared-secret token** (env var, e.g. `ROLLUP_REFRESH_TOKEN`); requests without it are rejected. It does not require a user session. Optionally bound to localhost as defense-in-depth.
- **FR-9:** All writes (nightly, lazy, rebuild) are **idempotent**, keyed on `(location_id, item_id, sale_date)` — re-running produces the same result and is safe under concurrency (R2).

**Lazy self-heal on read**
- **FR-10:** When a replenishment read requests a date range with days **missing** from the rollup (a skipped night, or a range older/newer than current coverage), the read **computes the missing days live from source and persists them** into the rollup, then returns the complete answer. This is documented as a deliberate, scoped exception to command-query separation — it populates a recomputable cache, not business state (R / Q8a).
- **FR-11:** Self-heal extends coverage in **both directions** — a query reaching before the backfilled history rolls up and persists those older days on demand; thereafter they are cached.

**Deploy backfill**
- **FR-12:** A one-shot backfill script consolidates the **last 13 months** of off-take for **all locations** into the rollup, runnable at deploy time.
- **FR-13:** The backfill runs in **chunks** (by month and/or location) rather than one giant transaction, to avoid long locks on the live ERP database (R6).
- **FR-14:** A **parity check** compares rollup sums against the live `sold` CTE for a sample of items/ranges and reports whether they match, to validate correctness before the rollup is trusted (R3).

**Scheduler registration**
- **FR-15:** A `.bat` script registers a Windows Task Scheduler entry that invokes the nightly refresh endpoint once per night, passing the shared-secret token. Running it sets up the schedule without manual Task Scheduler configuration.

**Admin panel**
- **FR-16:** `/admin` exposes a lightweight, read-only rollup-health view: **last refresh timestamp, covered date range, and total rows / distinct items**.
- **FR-17:** The admin panel provides a **manual "full rebuild"** action (rebuild the full 13-month window) and a **"refresh trailing window now"** action, both behind the admin-only guard.

## 6. Data Model

**New app-owned table: `item_sales_daily`** (created via the existing idempotent pattern in `create-app-tables.sql`; never an ActiveOne table).

| Field | Type | Notes |
|---|---|---|
| `location_id` | integer | ActiveOne location ID; part of composite key |
| `item_id` | integer | ActiveOne `item.ID`; part of composite key |
| `sale_date` | date | Raw source `DATE` (not timezone-normalized); part of composite key |
| `units_sold` | decimal | Summed base units (`QUANTITY × COALESCE(UNIT_BASE_QUANTITY,1)`) across both sources for that day |
| `updated_at` | datetime | Last time this row was (re)computed |

- **Primary/unique key:** `(location_id, item_id, sale_date)` — drives idempotent upsert.
- **Sparse:** no row for days with zero qualifying sales.

**Refresh metadata** (for the admin panel — last run time, covered range, row/item counts): stored either in a small app-owned meta table or derived on read (aggregate `MIN/MAX(sale_date)`, `COUNT(*)`, `COUNT(DISTINCT item_id)`, `MAX(updated_at)`). Exact placement decided at implementation; it must not require touching ActiveOne tables.

**Ownership:** table + refresh use case live in the `replenishment` module; wired in `container.ts`; the `/admin` panel reads health through the container (R5).

## 7. API Contract

**Nightly / trailing refresh endpoint** (new, under the replenishment module route convention)
- **Method:** POST (state-changing).
- **Auth:** shared-secret token via header or query param; no session. Reject (401/403) if missing/invalid.
- **Action:** recompute the trailing 7-day window for all locations; idempotent upsert.
- **Response:** minimal confirmation — status, window covered, rows affected, duration.

**Admin: full rebuild** (new)
- **Method:** POST. **Auth:** admin session.
- **Action:** rebuild the full 13-month window (chunked), all locations.
- **Response:** minimal confirmation (rows affected, duration, parity-check summary if run).

**Admin: refresh trailing window now** (new)
- **Method:** POST. **Auth:** admin session.
- **Action:** same as the nightly trailing-7-day recompute, triggered manually.
- **Response:** minimal confirmation.

**Admin: rollup health** (new)
- **Method:** GET. **Auth:** admin session.
- **Response:** last refresh timestamp, covered date range (min/max `sale_date`), total rows, distinct item count.

**Replenishment read** (existing endpoint, modified internally)
- **Method:** GET (unchanged contract). Internally swaps the `sold` CTE for a rollup read; on missing days, performs lazy self-heal (FR-10/11) and persists, then returns the same response shape as today.

## 8. UI/UX Flow

**Replenishment user (unchanged surface, faster):**
1. User runs replenishment for a location + suppliers + date range as today.
2. Server reads off-take from `item_sales_daily` instead of scanning raw sales; if days are missing it self-heals them inline.
3. Results return materially faster on heavy locations; the existing loading skeleton covers any residual wait (e.g. first-time self-heal of an old range). No new controls, no behavior change in the numbers.

**Admin (rollup health panel under `/admin`):**
1. Admin opens the rollup tab/section in `/admin`.
2. Sees read-only health: last refresh time, covered date range, total rows / item count.
3. May tap **Refresh trailing window now** (quick recompute of last 7 days) or **Full rebuild** (13-month rebuild). A confirmation is shown for the heavier rebuild; on completion the health metrics update.

**Operator (deploy/server, out-of-app):**
1. On deploy, runs the one-shot backfill script → populates 13 months for all locations (chunked) → optionally reports parity-check result.
2. Runs the `.bat` once → registers the nightly Windows Task Scheduler entry that calls the refresh endpoint with the token.

## 9. Edge Cases & Error Handling
- **Missed nightly run:** next replenishment read detects the gap and self-heals the missing days inline (FR-10); coverage metrics in `/admin` reveal the staleness.
- **Void/return after a day was rolled up:** absorbed by the nightly trailing-7-day recompute (FR-7); corrections older than 7 days require a manual rebuild.
- **Query range older than backfill (>13 months):** self-heal rolls up and persists those older days on demand (FR-11); first such query pays a one-time live cost, then it's cached.
- **Query range into the future / today partially complete:** today's row is within the trailing window and is recomputed nightly; intraday reads self-heal today as needed.
- **Refresh endpoint hit without/with wrong token:** rejected (401/403), no work performed.
- **Concurrent writers (nightly + lazy + rebuild):** idempotent key-based upsert makes overlapping writes safe (FR-9).
- **Item with sales on few days:** denominator stays the full calendar span, not row count, preventing rate inflation (FR-5).
- **Backfill interrupted mid-run:** chunked design means completed chunks persist; re-running is idempotent and resumes coverage without duplication.
- **Parity-check mismatch:** surfaced to the operator/admin as a warning so the rollup isn't trusted until the discrepancy (e.g. a missed filter) is resolved.
- **New location added in ActiveOne:** picked up automatically since refresh/backfill process all locations; first replenishment for it self-heals if backfill predates it.

## 10. Open Questions
- Exact storage of refresh metadata (dedicated small meta table vs. derived-on-read aggregates) — to be decided at implementation; must not touch ActiveOne tables.
- Whether the parity check ships as a one-shot script step only, or also as a permanent `/admin` "verify" action.
- Numeric type/precision for `units_sold` (decimal scale) to faithfully preserve `UNIT_BASE_QUANTITY`-flattened base quantities.
- Confirmation of the precise route paths for the new endpoints under the module's `/{module}/api` convention.

## 11. Out of Scope / Deferred
- **On-hand inventory rollup / snapshot** (the ~2.7s `item_inventory` collapse) — deferred; designed to reuse this same rollup pattern later.
- Any per-source (invoice vs sales-receipt) breakdown or sub-daily grain.
- Timezone-normalized (Asia/Manila) sale-day bucketing — current behavior buckets on raw source `DATE`; a Manila normalization would be a separate future change.
- Managed-platform cron or in-process scheduler.
- Promotion of the rollup to `app/shared/` for cross-module reuse.
