# PRD: Extract App-Owned Tables into a Separate `ops_hub` Schema
Date: 2026-08-13

## 1. Overview

Operations Hub currently stores its app-owned tables (users, RBAC, delivery,
counting mirror, replenishment history, supplier schedules, sales rollup, etc. —
everything in [`scripts/create-app-tables.sql`](../../scripts/create-app-tables.sql))
**inside the same MySQL schema as ActiveOne ERP**, connected via a single swappable pool
([`app/shared/infrastructure/db.ts`](../../app/shared/infrastructure/db.ts) + [`dbConfig.ts`](../../app/shared/infrastructure/dbConfig.ts)).

The app-owned tables are moved into their own **`ops_hub`** schema on the **same MySQL
server**. The ActiveOne schema keeps its existing name (the current `database` config
value). Two schemas on one server preserve the two things the code depends on and that a
separate server would break:

- **Cross-schema SQL JOINs still work** — a query can `JOIN greatwall_activeone.contact ON ops_hub.supplier_schedule.supplier_id …` as long as the app's DB user holds grants on both schemas.
- **Atomic transactions still span both** — InnoDB transactions are server-scoped, not schema-scoped, so the delivery/counting/replenishment commits (which write app snapshots *and* ActiveOne rows in one transaction) stay atomic.

The driving goal is **ownership / vendor isolation**: ActiveOne vendor updates or
replication can no longer entangle with app tables, and app tables no longer sit inside the
vendor's schema. This is schema-level ownership — **not** a security boundary (same server,
same DB user).

## 2. Goals

- Move every app-owned table out of the ActiveOne schema into a dedicated **`ops_hub`** schema.
- Keep one connection config (same host/port/user/password) with a **second schema name** — the app schema — so configuration and first-run bootstrap stay a single flow.
- Preserve every cross-schema JOIN and every cross-schema atomic transaction with no behavior change.
- Keep existing installs working unmodified until they choose to migrate (co-located fallback).
- Provide a one-time, re-runnable SQL migration that creates `ops_hub`, copies app rows out of ActiveOne, and drops the originals — without hand-rolling the table DDL.

## 3. Non-Goals

- **Does not** move to a separate server or a different DB engine. Same MySQL server, same `mysql2` driver.
- **Does not** create a per-schema DB *user* or any grant management — the single configured user must simply have rights on both schemas (documented, not automated).
- **Does not** auto-migrate data on boot. Migration is a manual, operator-run script.
- **Does not** add an app-schema "picker" beyond a second database-name field in the existing connection form.
- **Does not** change any ActiveOne schema, any ActiveOne write-back, PO/count minting, or the custom-field decoupling work.
- **Does not** touch the rollup scheduler / `schtasks` mechanics.

## 4. Users & Roles

- **Operators / admins** (`admin.database_settings`): the Database tab and first-run `/connect` form gain a second **App database** field; blank = co-located fallback (today's behavior).
- **All other users:** no visible change — every module behaves identically whether co-located or split.
- **ActiveOne (system of record):** unchanged; its schema no longer contains app tables after migration.

## 5. Functional Requirements

### Connection config (shared domain)

- **FR-1** [`DbConnectionConfig`](../../app/shared/domain/DbConnectionConfig.ts) gains an optional `appDatabase?: string`. `database` remains the **ActiveOne** schema; `appDatabase` is the app schema (`ops_hub`). When `appDatabase` is absent/blank, the app schema **is** `database` (co-located fallback — today's exact behavior).
- **FR-2** [`DbConnectionConfigInput`](../../app/shared/domain/DbConnectionConfig.ts) and [`coerceDbConfigInput`](../../app/shared/application/coerceDbConfigInput.ts) accept and coerce `appDatabase` the same way `database` is coerced (trim; blank stays blank). Structural validation continues to require `database`; `appDatabase` is optional.
- **FR-3** [`dbConfig.ts`](../../app/shared/infrastructure/dbConfig.ts) `readFileConfig`/`writeFileConfig`/`envConfig` persist and read `appDatabase`; `envConfig` reads an optional `DB_APP_NAME` env var. `resolveDbConfig()` returns the full shape (with `appDatabase` possibly undefined).

### Runtime pools

- **FR-4** [`db.ts`](../../app/shared/infrastructure/db.ts) builds **two pools from the one config**: the **ActiveOne pool** (default database = `database`) and the **app pool** (default database = `appDatabase ?? database`). Both share `host`/`port`/`user`/`password`. A helper resolves the app schema name (e.g. `appDatabaseName(cfg)`).
- **FR-5** `reconfigurePool(cfg)` hot-swaps **both** pools atomically; `testConnection(cfg)` verifies the connection works (it already only does `SELECT 1` — unchanged). The existing swappable-proxy pattern is extended so the **app pool** is swappable at runtime just like today's single pool.
- **FR-6** The existing default `pool` export keeps its semantics for **app-owned** queries; a new exported ActiveOne pool (e.g. `activeonePool`) serves ActiveOne-only reads. Both forward through the same live-swap proxy mechanism so `reconfigurePool` takes effect without restart. *(Exact export naming is a plan detail; the contract is: two live pools, one config.)*

### Schema-qualified mixed SQL

- **FR-7** Any query that references **both** an app table and an ActiveOne table must fully qualify the ActiveOne side with the ActiveOne schema name and the app side with the app schema name (or route so only one side needs qualifying). Mixed repositories are enumerated in the plan; the known set today: `MySQLSupplierScheduleRepository` (supplier_schedule ↔ contact), `MySQLSellingAreaMapRepository` (selling_area_feeder_map ↔ location), `MySQLReplenishmentSummaryRepository` (replenishment_summary ↔ contact/purchase_order/location), `MySQLReplenishmentRepository` & `MySQLStockoutRepository` (item_sales_daily/replenishment_summary ↔ item/contact/manufacturer/unit_of_measure/item_units), `MySQLSalesRollupRepository` (item_sales_daily ↔ invoice_items/sales_receipt_items), `MySQLItemMasterCacheRepository` (item_master_cache ↔ item/unit_of_measure), `MySQLDeliveryRepository` & `MySQLCountRepository` (app snapshot ↔ purchase_order/inventory_count), and `activeonePoMinting.ts` (purchase_order reads).
- **FR-8** The schema names used in qualification are **allow-listed** (config values, never user-typed SQL fragments) so interpolation is safe; identical to the existing `LEAD_TIME_FIELD` allow-list pattern.
- **FR-9** Cross-schema **transactions** (delivery supersede commit, counting commit, replenishment PO submit + history snapshot) remain a **single** `pool.getConnection()` transaction on **one** connection that can see both schemas (same server). No behavior change — only the table names on the "other" schema get qualified.

### Migration script

- **FR-10** A new [`scripts/migrate-app-schema.sql`](../../scripts/) (or a `.sql` + a short run instruction) performs, idempotently:
  1. `CREATE DATABASE IF NOT EXISTS ops_hub CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;`
  2. `USE ops_hub;` then apply the existing [`create-app-tables.sql`](../../scripts/create-app-tables.sql) — its `TABLE_SCHEMA = DATABASE()` checks now resolve against `ops_hub`, so it stays a single source of truth for table DDL.
  3. For every app-owned table, `INSERT INTO ops_hub.<t> SELECT * FROM <activeone>.<t>;` (copy rows).
  4. A **clearly-marked, separate** section `DROP TABLE <activeone>.<t>;` for the originals, commented to require explicit operator confirmation before running.
- **FR-11** The migration must **not** hardcode the ActiveOne schema name blindly — it documents the operator's ActiveOne schema name as a variable at the top of the file.
- **FR-12** The `replenishment_summary` table is safe to skip copying (it is a truncated-and-recomputed cache), but the script documents that choice rather than silently dropping it.

### UI / bootstrap

- **FR-13** [`DbConnectionForm`](../../app/shared/ui/DbConnectionForm.tsx) gains an **App database** field (optional, placeholder `ops_hub`, blank = same as ActiveOne). Its `payload()` includes `appDatabase`.
- **FR-14** [`GetDbConfigUseCase`](../../app/shared/application/GetDbConfigUseCase.ts) / `RedactedDbConfig` include `appDatabase` (redacted the same way; password never returned). The `/connect` form and admin Database tab both reflect the new field with no other change to their save/test flows.
- **FR-15** [`bootstrapGuard`](../../app/connect/bootstrapGuard.ts) and `isDbConfigured()` behavior is unchanged in spirit: an install is "configured" when the ActiveOne connection resolves; `appDatabase` is optional and does not gate first-run routing.

## 6. Data / Schema Changes

- **Config:** `data/db-config.json` gains `"appDatabase"` (absent for legacy installs → fallback). `.env.local` gains optional `DB_APP_NAME`.
- **New schema:** `ops_hub` (created by the migration script, not by app code).
- **App tables:** no column/DDL changes — the same `create-app-tables.sql` runs unchanged against `ops_hub`.
- **No ActiveOne schema alteration. No in-app data migration.**

## 7. Risks & Mitigations

- **R1 — Missing cross-schema grant.** The app DB user must have privileges on both schemas. Mitigation: documented in the migration script header; `testConnection` already surfaces permission failures at save time.
- **R2 — A mixed query left unqualified.** Any unqualified app-table reference run on the ActiveOne pool (or vice versa) fails at runtime. Mitigation: FR-7's enumerated sweep + the plan's repo-by-repo checklist; verification via `npx tsc --noEmit` + `npm run lint` plus a smoke run against a split schema.
- **R3 — Broken atomicity.** If a future edit routes a cross-schema write through two separate connections, it silently loses atomicity. Mitigation: FR-9 pins all cross-schema commits to one connection; the delivery/counting/replenishment commit paths are called out in the plan as "must remain single-connection".
- **R4 — Migration data loss.** `DROP TABLE` of originals is destructive. Mitigation: the drop is a separate, commented-out section requiring explicit confirmation; the copy step is idempotent (`INSERT … SELECT` on an already-copied table would duplicate, so the script uses a `DELETE`/truncate-guard or `INSERT … ON DUPLICATE` where a PK exists).
- **R5 — Legacy config without `appDatabase`.** Falls back to co-located behavior (FR-1), so a half-migrated or not-yet-migrated install keeps working exactly as today.

## 8. Rollout

- Ship as one change set: shared domain/application/infrastructure (config + pools), the enumerated mixed-query repositories, the migration SQL, and the connection form/use-case field.
- **Backward compatible:** with `appDatabase` unset, nothing observable changes — all queries are schema-equivalent to today's single-schema queries.
- **Operator steps:** (1) run `migrate-app-schema.sql` (copy + verify), (2) set `appDatabase = ops_hub` in the admin Database tab, (3) confirm the drop section and re-run to remove originals.
- **Verification:** against a dev ActiveOne dump, confirm (a) all modules work with `appDatabase = ops_hub` after copy, (b) delivery/counting/replenishment commits still land atomically, and (c) with `appDatabase` blank the app behaves identically to before the change.

## 9. Open Decisions

- **O1 — Second pool vs. single pool + full qualification.** *Recommended: two pools.* Two pools let the ~dozen ActiveOne-only and app-only repositories stay unqualified (zero churn), with qualification confined to the genuinely mixed repositories (FR-7). A single fully-qualified-everything pool is simpler in count but churns every SQL statement. The plan resolves the exact export names (`appPool` vs `activeonePool`) and which pool the default `pool` export becomes.
- **O2 — `replenishment_summary` in migration.** *Recommended: skip copy, document.* It is recomputable; copying adds nothing. Confirmed under FR-12.
