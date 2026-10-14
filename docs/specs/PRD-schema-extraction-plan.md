# Implementation Plan: Extract App-Owned Tables into `ops_hub`
Source PRD: [PRD-schema-extraction.md](./PRD-schema-extraction.md)
Date: 2026-08-13

## Summary

Move all app-owned tables into a separate `ops_hub` schema on the **same** MySQL server, keeping the ActiveOne schema (the current `database` config value) untouched. The single connection config gains an optional `appDatabase` field; `db.ts` builds **two swappable pools** from it (`pool` = app pool, new `activeonePool` = ActiveOne pool). ActiveOne-only repositories switch imports; mixed repositories keep `import pool` and schema-qualify every ActiveOne table reference via a shared helper. A one-time, re-runnable `scripts/migrate-app-schema.sql` copies app rows out of ActiveOne and (in a separate, confirmed section) drops the originals. With `appDatabase` blank, behavior is byte-for-byte today's co-located single-schema mode.

## Affected Areas

**Shared (`app/shared/`):**
- [`app/shared/domain/DbConnectionConfig.ts`](../../app/shared/domain/DbConnectionConfig.ts) — add `appDatabase?: string` to `DbConnectionConfig` + `DbConnectionConfigInput`; extend `validateDbConnectionConfig` (optional field).
- [`app/shared/application/coerceDbConfigInput.ts`](../../app/shared/application/coerceDbConfigInput.ts) — coerce `appDatabase`.
- [`app/shared/application/GetDbConfigUseCase.ts`](../../app/shared/application/GetDbConfigUseCase.ts) — `RedactedDbConfig` + mapper include `appDatabase`.
- [`app/shared/infrastructure/dbConfig.ts`](../../app/shared/infrastructure/dbConfig.ts) — read/write/env `appDatabase` (`DB_APP_NAME`).
- [`app/shared/infrastructure/db.ts`](../../app/shared/infrastructure/db.ts) — two pools + `activeonePool` export + schema-name helpers.
- [`app/shared/ui/DbConnectionForm.tsx`](../../app/shared/ui/DbConnectionForm.tsx) — App database field.

**Mixed repositories (keep `import pool`, qualify ActiveOne tables)** — see Step 6 for exact tables:
`MySQLSupplierScheduleRepository`, `MySQLSellingAreaMapRepository`, `MySQLLocationRepository`, `MySQLItemMasterCacheRepository`, `MySQLDeliveryRepository`, `MySQLCountRepository`, `MySQLReplenishmentRepository`, `MySQLStockoutRepository`, `MySQLReplenishmentSummaryRepository`, `MySQLSalesRollupRepository`, `MySQLPurchaseOrderRepository`, `MySQLReplenishmentHistoryRepository`.

**ActiveOne-only repositories (switch import to `activeonePool`):**
`MySQLManufacturerRepository`, `MySQLEmployeeDirectory`, `MySQLActiveOneUserDirectory`.

**Scripts:**
- [`scripts/create-app-tables.sql`](../../scripts/create-app-tables.sql) — unchanged (single source of truth; runs under `USE ops_hub`).
- New [`scripts/migrate-app-schema.sql`](../../scripts/migrate-app-schema.sql).
- [`scripts/backfill-sales-rollup.ts`](../../scripts/backfill-sales-rollup.ts) — qualify ActiveOne tables; write `item_sales_daily` via the app schema.
- [`scripts/seed-app-bootstrap.sql`](../../scripts/seed-app-bootstrap.sql) — note to run against `ops_hub` post-migration.

**`container.ts`:** no factory signature changes (store/tester/repo interfaces are unchanged); verify only.

## Decisions

- **Resolved by AI — two pools** (PRD O1): `pool` stays the app pool (default export, default database = `appDatabase ?? database`); add `activeonePool` (default database = `database`). Rationale: mixed repos already `import pool` (no import churn — only SQL edits), and app-only repos (~10 files) stay untouched; only 3 ActiveOne-only repos change imports.
- **Resolved by AI — mixed queries run on the app pool and qualify ActiveOne** (PRD FR-7/FR-9): the connection's default schema is `ops_hub`, so app tables resolve unqualified and every ActiveOne table gets an explicit `\`activeone\`.` prefix. Cross-schema transactions stay single-connection (they already are via `pool.getConnection()` / `withPoMintRetry`). The ActiveOne schema name is dynamic, so qualification must be interpolated **per query**, not baked into module-level `const` SQL.
- **Resolved by AI — schema-name helper lives in `db.ts`**: `activeoneSchemaName()` returns the backtick-quoted, validated ActiveOne schema name; `appSchemaName()` likewise for the app schema. Validation rejects a backtick in the configured name (same allow-list spirit as `LEAD_TIME_FIELD`).
- **Resolved by AI — app schema name default `ops_hub`** in the migration script and `DB_APP_NAME`/form placeholder; the value itself is operator-supplied.
- **Resolved by developer:** app schema = `ops_hub`; migration = manual SQL script + co-located fallback.

## Implementation Steps

### 1. Config domain — add `appDatabase`
[`DbConnectionConfig.ts`](../../app/shared/domain/DbConnectionConfig.ts)
- `DbConnectionConfig` gains `appDatabase?: string`. `database` remains the ActiveOne schema.
- `DbConnectionConfigInput` gains `appDatabase?: unknown`.
- `validateDbConnectionConfig`: leave `appDatabase` optional (no error when blank/absent); no change to the `database` requirement.

### 2. Coerce + redact
- [`coerceDbConfigInput.ts`](../../app/shared/application/coerceDbConfigInput.ts): add `appDatabase: String(input.appDatabase ?? "").trim() || undefined` (blank → `undefined` so the fallback in `db.ts` sees "not set"). Keep password coalescing untouched.
- [`GetDbConfigUseCase.ts`](../../app/shared/application/GetDbConfigUseCase.ts): `RedactedDbConfig` gains `appDatabase: string | null`; mapper emits `config.appDatabase ?? null`.

### 3. Config file + env
[`dbConfig.ts`](../../app/shared/infrastructure/dbConfig.ts)
- `readFileConfig`: accept optional `appDatabase` (string) without requiring it.
- `writeFileConfig`: persist `appDatabase` when set (omit when undefined so legacy files stay minimal).
- `envConfig`: read `DB_APP_NAME` into `appDatabase` when present.

### 4. Two pools + schema helpers
[`db.ts`](../../app/shared/infrastructure/db.ts)
- Add `buildPool(cfg, databaseName)` so one builder serves both; `buildPool(cfg, cfg.appDatabase ?? cfg.database)` for the app pool and `buildPool(cfg, cfg.database)` for the ActiveOne pool.
- Keep `activePool` (app pool) behind the existing Proxy default export `pool`; add `let activeOneActivePool` + a second Proxy `activeonePool`. `reconfigurePool(cfg)` rebuilds **both** and drains both previous pools.
- Export helpers (validate the name contains no backtick, then wrap in backticks):
  - `activeoneSchemaName(): string` → `` `\`${cfg.database}\`` `` (ActiveOne schema).
  - `appSchemaName(): string` → `` `\`${cfg.appDatabase ?? cfg.database}\`` ``.
  - Resolve `cfg` fresh each call (`resolveDbConfig()`) so a runtime `reconfigurePool` is honored by every subsequent query.
- `testConnection` unchanged (still `SELECT 1`).

### 5. Switch ActiveOne-only repositories to `activeonePool`
Change `import pool from "@/app/shared/infrastructure/db"` to `import { activeonePool as pool } from "@/app/shared/infrastructure/db"` (local alias `pool` so the body is untouched) in:
- [`MySQLManufacturerRepository.ts`](../../app/(authenticated)/manufacturer/infrastructure/MySQLManufacturerRepository.ts) — `item`/`contact`/`manufacturer`.
- [`MySQLEmployeeDirectory.ts`](../../app/(authenticated)/admin/infrastructure/MySQLEmployeeDirectory.ts) — `contact`.
- [`MySQLActiveOneUserDirectory.ts`](../../app/(authenticated)/admin/infrastructure/MySQLActiveOneUserDirectory.ts) — `` `user` ``.
- (`MySQLInvoiceRepository` / `MySQLTransferRepository` are stubs returning `[]` and import no pool — no change.)

### 6. Qualify ActiveOne tables in mixed repositories
For each file, import `activeoneSchemaName` and prefix ActiveOne tables. Move any module-level `const` SQL that references ActiveOne tables into a per-call builder (or inline) so the interpolated schema name is current at query time. **App tables stay unqualified** (they resolve against the app pool's default schema). Table-by-table:

- [`MySQLSupplierScheduleRepository.ts`](../../app/shared/infrastructure/MySQLSupplierScheduleRepository.ts): `DATA_SQL` `FROM ${activeoneSchemaName()}.contact c` (lead-time join); `getMostRecentPoDate` `FROM ${...}.purchase_order`. (`supplier_schedule` stays unqualified.)
- [`MySQLSellingAreaMapRepository.ts`](../../app/shared/infrastructure/MySQLSellingAreaMapRepository.ts): `LEFT JOIN ${...}.location sa/f` in `getAll`, `getSellingAreaIdsByFeeder`, `getSellingAreaFeederNames`. (`selling_area_feeder_map` unqualified.)
- [`MySQLLocationRepository.ts`](../../app/(authenticated)/location/infrastructure/MySQLLocationRepository.ts): `FROM ${...}.location l` in `getAll`/`getById` (it is mixed — joins `module_location_visibility`, an app table).
- [`MySQLItemMasterCacheRepository.ts`](../../app/(authenticated)/delivery/infrastructure/MySQLItemMasterCacheRepository.ts): refresh's `INSERT … SELECT … FROM ${...}.item it LEFT JOIN ${...}.unit_of_measure uom`. (`item_master_cache` unqualified.)
- [`MySQLDeliveryRepository.ts`](../../app/(authenticated)/delivery/infrastructure/MySQLDeliveryRepository.ts): qualify `purchase_order`, `purchase_order_items`, `contact`, `item`, `item_units`, `unit_of_measure`, `location` in `listOpenPurchaseOrders`, `getPurchaseOrderForReceiving`, `commit` (including the `MAX(ID)` reads and the `INSERT INTO purchase_order(_items)` / `UPDATE purchase_order`). (`delivery*`, `users` unqualified.)
- [`MySQLCountRepository.ts`](../../app/(authenticated)/counting/infrastructure/MySQLCountRepository.ts): qualify `contact`, `` `user` ``, `item`, `item_location_units`, `unit_of_measure`, `item_units`, `location`, `inventory_count`, `inventory_count_items` in `getCounterGate` + `commit`. (`users`, `item_master_cache`, `stock_count*` unqualified.)
- [`MySQLReplenishmentRepository.ts`](../../app/(authenticated)/replenishment/infrastructure/MySQLReplenishmentRepository.ts): `buildCandidatesSQL` already a per-call builder — qualify `item`, `item_inventory`, `purchase_order`, `purchase_order_items`, `contact`, `item_units`, `unit_of_measure`, `manufacturer`, `location`. (`item_sales_daily` unqualified.)
- [`MySQLStockoutRepository.ts`](../../app/(authenticated)/replenishment/infrastructure/MySQLStockoutRepository.ts): same set as Replenishment minus `location`. (`item_sales_daily` unqualified.)
- [`MySQLReplenishmentSummaryRepository.ts`](../../app/(authenticated)/replenishment/infrastructure/MySQLReplenishmentSummaryRepository.ts): `RECOMPUTE_SQL` already a `const` but must become per-call — qualify `item`, `contact`, `item_inventory`, `purchase_order`, `purchase_order_items`, `location`. (`item_sales_daily`, `replenishment_summary` unqualified.)
- [`MySQLSalesRollupRepository.ts`](../../app/(authenticated)/replenishment/infrastructure/MySQLSalesRollupRepository.ts): `AGGREGATE_SALES_SQL` and `allLocationIds` — qualify `invoice`, `invoice_items`, `sales_receipt`, `sales_receipt_items`, `location`. (`item_sales_daily` unqualified.)
- [`MySQLPurchaseOrderRepository.ts`](../../app/(authenticated)/replenishment/infrastructure/MySQLPurchaseOrderRepository.ts): qualify `item`, `item_units`, `manufacturer`, `contact`, `location`, `purchase_order`, `purchase_order_items` in `saveDraft`, `createAll`, `createPOsFromDraft`, `persistRunSnapshot`. (`users`, `replenishment_run*` unqualified.)
- [`MySQLReplenishmentHistoryRepository.ts`](../../app/(authenticated)/history/infrastructure/MySQLReplenishmentHistoryRepository.ts): the delete-run guard reads `purchase_order` (line ~372) — qualify it. (Rest of `replenishment_run*` unqualified.)

### 7. UI — App database field
[`DbConnectionForm.tsx`](../../app/shared/ui/DbConnectionForm.tsx): add `appDatabase` state (initial from `initial?.appDatabase ?? ""`, placeholder `ops_hub`, helper text "blank = same as ActiveOne"); include in `payload()` and `DbConnectionFormValues`. The `/connect` form and admin Database tab both consume this component, so no further page edits.

### 8. Migration script
New [`scripts/migrate-app-schema.sql`](../../scripts/migrate-app-schema.sql):
- Header documents: operator edits `@activeone_db` (default `greatwall_activeone`) and `@app_db` (default `ops_hub`); the DB user needs grants on both schemas; run in two passes.
- Pass 1 (safe, idempotent): `CREATE DATABASE IF NOT EXISTS ops_hub …;` then `USE ops_hub;` and apply the statements from `create-app-tables.sql` (copy the file body verbatim — its `TABLE_SCHEMA = DATABASE()` checks now target `ops_hub`). Then, for each of the 19 copied tables (all except `replenishment_summary`), `INSERT INTO \`ops_hub\`.\`t\` SELECT * FROM \`activeone\`.\`t\`;` using `INSERT IGNORE` for idempotency on the PK.
  - Copy list (19): `module_location_visibility`, `app_settings`, `users`, `stock_count`, `stock_count_items`, `supplier_schedule`, `delivery`, `delivery_new_items`, `item_master_cache`, `item_sales_daily`, `selling_area_feeder_map`, `replenishment_run`, `replenishment_run_po`, `replenishment_run_line`, `role`, `role_permission`, `user_role`, `delivery_return_excess`, `delivery_line`.
  - `replenishment_summary` is **not** copied (recomputed cache, PRD FR-12) — documented inline.
- Pass 2 (commented-out, requires confirmation): `DROP TABLE \`activeone\`.\`t\`;` for all 20 tables (including `replenishment_summary`).
- Note: `seed-app-bootstrap.sql` (and other `seed-*.sql`) must now run under `USE ops_hub`.

### 9. Backfill script
[`scripts/backfill-sales-rollup.ts`](../../scripts/backfill-sales-rollup.ts): build a pool per schema (or one pool + qualified names). Minimal change: keep the ActiveOne pool (default `database = cfg.database`) for `AGGREGATE_SQL`/`PARITY_LIVE_SQL`/`location`, and qualify `item_sales_daily` reads/writes as `` `${cfg.appDatabase ?? cfg.database}`.item_sales_daily ``. Mirror the app's `appDatabase` fallback.

### 10. Verify
- `npx tsc --noEmit` and `npm run lint` (authoritative per CLAUDE.md; `next build` is environmentally broken and must not be re-diagnosed).
- Grep audit: no remaining `FROM contact`, `FROM item`, `FROM purchase_order`, `FROM location`, `FROM inventory_count`, `FROM \`user\``, `FROM invoice`, `FROM sales_receipt` outside an `activeoneSchemaName()` interpolation, except in the 3 ActiveOne-only repos (which run on `activeonePool`).
- Smoke (manual, against a dev dump): with `appDatabase` blank, all modules behave as before; with `appDatabase = ops_hub` after the copy pass, delivery/counting/replenishment commits still land atomically.

## Risks & Open Questions

- **R1 — a missed ActiveOne reference** in a mixed repo fails at runtime only when split. Mitigated by the Step 10 grep audit (comprehensive, listed table names are finite and known).
- **R2 — stale schema name on hot-swap.** Module-level `const` SQL would cache the old ActiveOne name. Mitigated by making all mixed SQL per-call (Step 6); `activeoneSchemaName()` reads config fresh each call.
- **R3 — cross-schema grant.** The single DB user must hold privileges on `ops_hub` and the ActiveOne schema. Documented in the migration header; `testConnection` surfaces permission errors at save time.
- **R4 — migration copy idempotency.** `INSERT IGNORE … SELECT *` relies on identical column order between source and target (guaranteed — both created by the same `create-app-tables.sql`). Verify column order matches for `users`/`delivery`/`stock_count` which accumulate idempotent `ALTER` columns over time; if any drift, switch to explicit column lists.
- **Open — verify `replenishment_summary` truly never needs its data copied** (it is recomputed on read and truncated on recompute; safe to skip).
