# Implementation Plan: Replenishment Selling-Area Demand Pooling
Source PRD: [PRD-replenishment-selling-area-demand-pooling.md](PRD-replenishment-selling-area-demand-pooling.md)
Date: 2026-06-30

## Summary
Add an app-owned feeder↔selling-area map, configured in a new `/admin` **Order Pooling** tab, that lets a warehouse's Standard replenishment run pool its mapped selling areas' real off-take into the warehouse's own demand — without ever trusting the selling area's physical count. The Standard sales-rate query is extended to sum `item_sales_daily` rows across the feeder **plus** its mapped selling areas (same range, same full-span denominator), surfacing a combined daily rate and a new shelf-portion breakdown column. The replenishment location picker grays out configured selling areas. Zero mappings = byte-for-byte today's behavior.

## Affected Areas

**New shared code (`app/shared/` — used by admin, replenishment, and location, mirroring `supplier_schedule`'s placement):**
- [app/shared/domain/SellingAreaMap.ts](../../app/shared/domain/SellingAreaMap.ts) — `SellingAreaMapping`, `SellingAreaMapInput`, `FeederSellingAreas` types.
- [app/shared/domain/SellingAreaMapRepository.ts](../../app/shared/domain/SellingAreaMapRepository.ts) — port.
- [app/shared/infrastructure/MySQLSellingAreaMapRepository.ts](../../app/shared/infrastructure/MySQLSellingAreaMapRepository.ts) — adapter (JOINs ActiveOne `location` for names + `INACTIVE` staleness). Mirrors [MySQLSupplierScheduleRepository.ts](../../app/shared/infrastructure/MySQLSupplierScheduleRepository.ts).

**Admin module (`app/(authenticated)/admin/`):**
- New use cases in `application/`: `GetSellingAreaMappingsUseCase`, `SaveSellingAreaMappingUseCase` (holds FR-3 validation), `RemoveSellingAreaMappingUseCase`.
- New API: [app/(authenticated)/admin/api/order-pooling/route.ts](../../app/(authenticated)/admin/api/order-pooling/route.ts) (GET/POST/DELETE, admin-gated via [requireAdmin.ts](../../app/(authenticated)/admin/api/requireAdmin.ts)).
- New client tab component `app/(authenticated)/admin/OrderPoolingTab.tsx` (Users-tab pattern: card list grouped by feeder + slide-up `Sheet`).
- Modify [app/(authenticated)/admin/page.tsx](../../app/(authenticated)/admin/page.tsx) — add an **Order Pooling** `TabsTrigger`/`TabsContent`.

**Replenishment module (`app/(authenticated)/replenishment/`):**
- [domain/ReplenishmentItem.ts](../../app/(authenticated)/replenishment/domain/ReplenishmentItem.ts) — add `sellingAreaDemand: number` + `sellingAreaNames: string[]`.
- [domain/ReplenishmentRepository.ts](../../app/(authenticated)/replenishment/domain/ReplenishmentRepository.ts) — extend `getGroups` with `sellingAreaIds: number[]`.
- [application/GetReplenishmentGroupsUseCase.ts](../../app/(authenticated)/replenishment/application/GetReplenishmentGroupsUseCase.ts) — inject `SellingAreaMapRepository` + `SalesRollupRepository`; resolve mapped selling areas, self-heal their days, pass ids to the repo.
- [infrastructure/MySQLReplenishmentRepository.ts](../../app/(authenticated)/replenishment/infrastructure/MySQLReplenishmentRepository.ts) — pool the `sold` CTE across feeder + selling areas; add a `shelf` CTE for the breakdown + contributing names.
- [page.tsx](../../app/(authenticated)/replenishment/page.tsx) — add the **Selling-Area Demand** column to the Standard table (right of **Daily Rate**); bump header-row `colSpan` 8→9.

**Location module (`app/(authenticated)/location/`):**
- [domain/Location.ts](../../app/(authenticated)/location/domain/Location.ts) — add `fedByFeederName?: string | null`.
- [application/GetLocationsUseCase.ts](../../app/(authenticated)/location/application/GetLocationsUseCase.ts) — inject `SellingAreaMapRepository`; when `module === "replenishment"`, annotate selling areas with their feeder name.
- [page.tsx](../../app/(authenticated)/location/page.tsx) — render annotated tiles disabled with the "Fed by …" note.
- [app/shared/ui/SelectionTile.tsx](../../app/shared/ui/SelectionTile.tsx) — add a `disabled` prop (non-interactive + muted).

**Shared UI (new):**
- `app/shared/ui/tooltip.tsx` — shadcn Tooltip primitive (`npx shadcn@latest add tooltip`) for the FR-14 breakdown tooltip.

**DB (our own tables — `scripts/create-app-tables.sql`):**
- New table `selling_area_feeder_map` (`selling_area_location_id` PK, `feeder_location_id`, `created_at`, `updated_at`). No changes to `item_sales_daily`, `supplier_schedule`, or any ActiveOne table.

**container.ts factories:**
- Add `createGetSellingAreaMappingsUseCase`, `createSaveSellingAreaMappingUseCase`, `createRemoveSellingAreaMappingUseCase`.
- Modify `createGetReplenishmentGroupsUseCase` (inject map + rollup repos) and `createGetLocationsUseCase` (inject map repo).

## Decisions

- **Resolved by AI: Table name `selling_area_feeder_map`** — descriptive snake_case consistent with other app-owned tables; PK `selling_area_location_id` enforces FR-2's one-feeder rule (PRD §6).
- **Resolved by AI: Map port/adapter live in `app/shared/`** — consumed by 3 modules (admin, replenishment, location), matching the existing `supplier_schedule` cross-cutting precedent (CLAUDE.md "Shared code → `app/shared/`").
- **Resolved by AI: FR-3 validation in the `SaveSellingAreaMappingUseCase` (application boundary)** — PRD §6 says guards are enforced at the application boundary, not only schema; matches Fail-Fast at the use case.
- **Resolved by AI: Self-heal scope = mapped selling areas only** — FR-19's explicit requirement. The feeder location's own coverage is unchanged (already relies on nightly refresh + backfill; not self-healed in the Standard read today), keeping this change minimal.
- **Resolved by AI: Pooling resolved inside the single enriched SQL query** via a `sold` CTE over `location_id IN (feeder + selling areas)` plus a `shelf` CTE for the breakdown — honors CLAUDE.md "all unit data resolved in a single enriched SQL query — no per-item round-trips"; the combined `units_sold > 0` filter automatically surfaces shelf-only SKUs (FR-11).
- **Resolved by AI: `effective_available` untouched** — the `on_hand`/`incoming` CTEs already scope to the single feeder `locationId`; pooling only changes the `sold` CTE (FR-8).
- **Resolved by AI: Location guardrail composed in `GetLocationsUseCase`** (not the repository) — keeps `MySQLLocationRepository` a pure ActiveOne+visibility adapter; the cross-cutting selling-area concern is injected and applied only for `module === "replenishment"` (FR-16/17).
- **Resolved by AI: shadcn Tooltip primitive** for the breakdown tooltip — design system says prefer shadcn primitives in `app/shared/ui/`.
- **Assumptions (PRD §10 open questions, defaulted — low-stakes, not asked):**
  - Column label: **"Selling-Area Demand"**.
  - Tab name: **"Order Pooling"** (as used throughout the PRD).
  - Tooltip lists every contributing selling area by name (comma-separated). Touch caveat: Radix tooltip opens on long-press/focus; acceptable for the small, optional breakdown. The cell also carries a native `title` fallback.

## Implementation Steps

### 1. DB — add the map table
In [scripts/create-app-tables.sql](../../scripts/create-app-tables.sql), append (idempotent `CREATE TABLE IF NOT EXISTS`, no FK into ActiveOne, like `supplier_schedule`):
```sql
CREATE TABLE IF NOT EXISTS `selling_area_feeder_map` (
  `selling_area_location_id` int      NOT NULL,
  `feeder_location_id`       int      NOT NULL,
  `created_at`               datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`               datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`selling_area_location_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

### 2. Shared domain — types + port
- [app/shared/domain/SellingAreaMap.ts](../../app/shared/domain/SellingAreaMap.ts):
  ```ts
  export interface SellingAreaMapping {
    sellingAreaLocationId: number;
    sellingAreaName: string | null; // null when removed in ActiveOne
    feederLocationId: number;
    feederName: string | null;
    stale: boolean;                 // either side INACTIVE or missing
  }
  export interface SellingAreaMapInput { sellingAreaLocationId: number; feederLocationId: number; }
  ```
- [app/shared/domain/SellingAreaMapRepository.ts](../../app/shared/domain/SellingAreaMapRepository.ts):
  ```ts
  export interface SellingAreaMapRepository {
    getAll(): Promise<SellingAreaMapping[]>;                    // admin list + name/stale resolution
    getSellingAreaIdsByFeeder(feederLocationId: number): Promise<number[]>; // pooling (active areas only)
    getSellingAreaFeederNames(): Promise<Map<number, string>>; // location guardrail: sellingAreaId → feederName
    upsert(input: SellingAreaMapInput): Promise<void>;
    remove(sellingAreaLocationId: number): Promise<void>;
    getFeederIds(): Promise<number[]>;                          // validation
    getSellingAreaIds(): Promise<number[]>;                     // validation
  }
  ```

### 3. Shared infrastructure — adapter
[app/shared/infrastructure/MySQLSellingAreaMapRepository.ts](../../app/shared/infrastructure/MySQLSellingAreaMapRepository.ts), mirroring `MySQLSupplierScheduleRepository`:
- `getAll()` — `SELECT saf.*, sa.NAME AS selling_area_name, sa.INACTIVE AS sa_inactive, f.NAME AS feeder_name, f.INACTIVE AS f_inactive FROM selling_area_feeder_map saf LEFT JOIN location sa ON sa.ID = saf.selling_area_location_id LEFT JOIN location f ON f.ID = saf.feeder_location_id ORDER BY f.NAME, sa.NAME`. `stale = sa IS NULL OR sa_inactive=1 OR f IS NULL OR f_inactive=1` (FR-20).
- `getSellingAreaIdsByFeeder(id)` — `SELECT saf.selling_area_location_id FROM selling_area_feeder_map saf JOIN location sa ON sa.ID = saf.selling_area_location_id AND sa.INACTIVE=0 WHERE saf.feeder_location_id = ?` (skip stale pairs in pooling, FR-20).
- `getSellingAreaFeederNames()` — selling-area id → feeder `location.NAME` (active feeders).
- `upsert` — `INSERT … ON DUPLICATE KEY UPDATE feeder_location_id = VALUES(feeder_location_id)` (PK upsert replaces prior feeder, edge case §9).
- `remove`, `getFeederIds`, `getSellingAreaIds` — trivial.

### 4. Admin application — use cases (with validation)
- `application/GetSellingAreaMappingsUseCase.ts` — `execute(): Promise<SellingAreaMapping[]>` → `repo.getAll()`.
- `application/SaveSellingAreaMappingUseCase.ts` — `execute(input)`:
  - Reject `feederLocationId === sellingAreaLocationId` (FR-3a).
  - Reject if `sellingAreaLocationId ∈ getFeederIds()` (location already a feeder, FR-3b).
  - Reject if `feederLocationId ∈ getSellingAreaIds()` (chosen feeder is itself a selling area / chain, FR-3c).
  - Throw a typed/validation error (e.g. `{ name: "ValidationError", message }`) the route maps to **400**; else `repo.upsert(input)`.
- `application/RemoveSellingAreaMappingUseCase.ts` — `execute(sellingAreaLocationId)` → `repo.remove(...)`.

### 5. Admin API route
[app/(authenticated)/admin/api/order-pooling/route.ts](../../app/(authenticated)/admin/api/order-pooling/route.ts):
- `if (!(await requireAdmin())) return 403` at the top of each handler.
- `GET` → `{ mappings: SellingAreaMapping[] }`.
- `POST` → validate body shape (two positive ints), call `SaveSellingAreaMappingUseCase`; catch ValidationError → 400 with message; success → `{ mapping }` (re-read or echo).
- `DELETE` → `{ sellingAreaLocationId }`, call `RemoveSellingAreaMappingUseCase`, return `{ success: true }`.
- Pattern: HTTP-only adapter resolving use cases from `container.ts` (CLAUDE.md api/route.ts rule).

### 6. container.ts factories
- `createGetSellingAreaMappingsUseCase`, `createSaveSellingAreaMappingUseCase`, `createRemoveSellingAreaMappingUseCase` → `new …UseCase(new MySQLSellingAreaMapRepository())`.
- Change `createGetReplenishmentGroupsUseCase` →
  `new GetReplenishmentGroupsUseCase(new MySQLReplenishmentRepository(), new MySQLSellingAreaMapRepository(), new MySQLSalesRollupRepository())`.
- Change `createGetLocationsUseCase` →
  `new GetLocationsUseCase(new MySQLLocationRepository(), new MySQLSellingAreaMapRepository())`.

### 7. Replenishment domain + use case (pooling orchestration)
- [domain/ReplenishmentItem.ts](../../app/(authenticated)/replenishment/domain/ReplenishmentItem.ts) — add `sellingAreaDemand: number;` and `sellingAreaNames: string[];`.
- [domain/ReplenishmentRepository.ts](../../app/(authenticated)/replenishment/domain/ReplenishmentRepository.ts) — `getGroups(from, to, locationId, supplierIds, sellingAreaIds: number[])`.
- [application/GetReplenishmentGroupsUseCase.ts](../../app/(authenticated)/replenishment/application/GetReplenishmentGroupsUseCase.ts) — constructor now `(repository, sellingAreaMap: SellingAreaMapRepository, salesRollup: SalesRollupRepository)`:
  1. `const sellingAreaIds = await sellingAreaMap.getSellingAreaIdsByFeeder(locationId)`.
  2. Self-heal (FR-19): `for (const id of sellingAreaIds) await salesRollup.ensureDaysExist(id, fromStr, toStr)` (format dates as `YYYY-MM-DD`).
  3. `return repository.getGroups(from, to, locationId, supplierIds, sellingAreaIds)`.

### 8. Replenishment repository — pooled SQL
In [infrastructure/MySQLReplenishmentRepository.ts](../../app/(authenticated)/replenishment/infrastructure/MySQLReplenishmentRepository.ts):
- Replace the `sold` CTE filter `isd.location_id = ?` with `isd.location_id IN (?)` where the array is `[locationId, ...sellingAreaIds]` (mysql2 `pool.query` expands array IN).
- Add a `shelf` CTE (only when `sellingAreaIds.length > 0`), summing the selling-area-only portion and concatenating contributing names:
  ```sql
  shelf AS (
    SELECT isd.item_id,
           SUM(isd.units_sold) AS shelf_units,
           GROUP_CONCAT(DISTINCT loc.NAME ORDER BY loc.NAME SEPARATOR '') AS shelf_areas
    FROM item_sales_daily isd
    JOIN location loc ON loc.ID = isd.location_id
    WHERE isd.location_id IN (?selling areas?) AND isd.sale_date BETWEEN ? AND ?
      AND isd.item_id IN (SELECT item_id FROM supplier_items)
    GROUP BY isd.item_id
  )
  ```
  LEFT JOIN it and select `COALESCE(sh.shelf_units,0) AS shelf_units`, `sh.shelf_areas`. When no selling areas, omit the CTE/join and treat `shelf_units = 0`, `shelf_areas = NULL` (build SQL/params conditionally — same technique the supplier-schedule repo uses for its optional `IN`).
- `WHERE COALESCE(sd.units_sold, 0) > 0` is unchanged but now reflects **combined** units, so shelf-only SKUs surface (FR-11) while still gated by `supplier_items` (selected suppliers).
- Arithmetic in the row loop:
  - `dailySalesRate = combined units_sold / days / conversionFactor` (combined; `days` stays the full inclusive calendar span — FR-7; **do not** change `daysInRangeInclusive`).
  - `sellingAreaDemand = shelf_units / days / conversionFactor` (purchase units, FR-14).
  - `sellingAreaNames = shelf_areas ? shelf_areas.split("") : []`.
  - DOS, `isCritical`, suggestion (`rawOrder` at `MAX_ORDER_PERIOD`) all use the combined `dailySalesRate` (FR-9/10) — existing code already keys off `dailySalesRate`, so no formula change beyond the new value.
- Default the two new fields to `0` / `[]` so a no-mapping run is byte-for-byte today (FR-18).

### 9. Replenishment UI — new column
In [page.tsx](../../app/(authenticated)/replenishment/page.tsx) Standard table (header ~line 1228, rows ~line 1390):
- Add `<th className={cn(TH, "text-right")}>Selling-Area Demand</th>` immediately after the **Daily Rate** `<th>` (line 1237).
- Add a matching `<td>` after the Daily Rate cell (line 1447): when `item.sellingAreaDemand > 0`, render the mono number wrapped in a `Tooltip` whose content lists `item.sellingAreaNames.join(", ")` (also set `title=` as a fallback); else render `0`/`—` (FR-15). Mirror the existing `tabular-nums` cell styling.
- Bump every Standard header row `colSpan={8}` → `colSpan={9}` (supplier header line 1291, mfg header line 1351) so spans stay aligned with the now-10-column body.
- Leave the **Stockout** table untouched (Standard path only, FR/Non-Goal §3).

### 10. Location guardrail
- [app/shared/ui/SelectionTile.tsx](../../app/shared/ui/SelectionTile.tsx) — add `disabled?: boolean`; when set, render `<button disabled>` with muted styling and skip `onSelect`.
- [domain/Location.ts](../../app/(authenticated)/location/domain/Location.ts) — add `fedByFeederName?: string | null`.
- [application/GetLocationsUseCase.ts](../../app/(authenticated)/location/application/GetLocationsUseCase.ts) — constructor `(repository, sellingAreaMap: SellingAreaMapRepository)`; in `execute(module, showAll)`: fetch locations as today, then if `module === "replenishment"` look up `getSellingAreaFeederNames()` and set `fedByFeederName` on matching locations (FR-16); other modules unchanged (FR-17).
- [page.tsx](../../app/(authenticated)/location/page.tsx) — in the tile map, when `loc.fedByFeederName` is set, render `<SelectionTile disabled>` with a `type-caption` note: `Fed by {loc.fedByFeederName} — replenished via that warehouse`.

### 11. Admin Order Pooling tab UI
- New `app/(authenticated)/admin/OrderPoolingTab.tsx` (copy the Users-tab structure from [UsersTab.tsx](../../app/(authenticated)/admin/UsersTab.tsx)):
  - Load `GET /admin/api/order-pooling`; render a searchable card list **grouped under feeder section headers**; each card shows selling-area name + feeder; `stale` mappings show a `warning`-token marker (FR-20).
  - "+ Add selling area" / tapping a card opens a `Sheet` to pick the selling-area location and its single feeder (location lists fetched from existing `/location/api?module=replenishment&showAll=true`); inline error on a 400 validation response (FR-3 messages).
  - Save → `POST`; "Remove mapping" → `DELETE`; reload on success.
- [admin/page.tsx](../../app/(authenticated)/admin/page.tsx) — add `<TabsTrigger value="order-pooling-map">Order Pooling</TabsTrigger>` and a `<TabsContent>` rendering `<OrderPoolingTab />`. (Note: the existing `order-scheduling` tab value is distinct; pick a non-colliding value such as `order-pooling`.)

## Risks & Open Questions
- **Self-heal cost on wide ranges:** `ensureDaysExist` for a selling area with sparse coverage computes missing days live (the ~7s source scan) on first run; acceptable and consistent with the summary recompute, but worth watching on a 30-day default range for a busy selling area.
- **Deep-linked selling-area `locationId`:** FR-16 only guards the picker. A hand-crafted `/replenishment?locationId={sellingArea}` would run normally against that location's bad count. PRD doesn't require blocking it; optionally the replenishment GET could reject a `locationId` present in `getSellingAreaIds()` — flag for the developer if desired.
- **Tooltip on touch:** Radix tooltip is long-press/focus-driven on Android; verify tap-friendliness on a real tablet, or fall back to an inline caption if it feels poor (PRD §10 open question).
- **`GROUP_CONCAT` length:** group_concat_max_len defaults to 1024 bytes — ample for a handful of selling-area names; not a concern at expected cardinality.
- **Verify against live data:** confirm `location.INACTIVE` is the correct staleness signal and that selling areas actually accrue `item_sales_daily` rows (per memory, local dump sales end ~Feb 2026, so pooled rates may read 0 in dev — validate math with a seeded date range).
