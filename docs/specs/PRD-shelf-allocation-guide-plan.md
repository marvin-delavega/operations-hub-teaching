# Implementation Plan: Shelf Allocation Guide
Source PRD: [PRD-shelf-allocation-guide.md](./PRD-shelf-allocation-guide.md)
Date: 2026-08-21

## Summary

Build a read-only **Shelf Guide** module (`/shelfguide`) that ranks suppliers and items by recency-weighted daily sales for a single selected location. Two views in one client page (supplier overview + supplier detail via `?supplierId=`), backed by two GET endpoints. Data comes from the existing `item_sales_daily` rollup (self-healed on read); no schema change, no chart library (token-styled div bars), no persistence. Plus a new admin tab for the default-location setting and two new RBAC permission keys.

## Affected Areas

**New module** `app/(authenticated)/shelfguide/` (four-layer, per CLAUDE.md module layout):
- `domain/ShelfGuide.ts` — DTO types
- `domain/ShelfGuideRepository.ts` — port interface (`ShelfGuideRepository` + narrow `SalesDaysEnsurer`)
- `domain/weighting.ts` — pure functions (half-life weighting, ABC tiers, aggregation)
- `application/GetShelfGuideOverviewUseCase.ts`
- `application/GetShelfGuideDetailUseCase.ts`
- `infrastructure/MySQLShelfGuideRepository.ts`
- `page.tsx` — client page (both views)
- `api/route.ts` — overview GET
- `api/[supplierId]/route.ts` — detail GET

**Shared / existing code reused (no change unless noted):**
- `app/(authenticated)/replenishment/infrastructure/MySQLSalesRollupRepository.ts` — reuse `ensureDaysExist` for self-heal.
- `app/(authenticated)/location/api/route.ts` (`/location/api`) — powers the location dropdown on both guide screens and the admin tab.
- `app/shared/ui/` primitives: `Card`, `Input`, `Label`, `Badge`, `Button`, `Skeleton` (no new primitive needed).
- `app/(authenticated)/admin/infrastructure/MySQLAppSettingsRepository.ts` — pattern for reading `app_settings` directly (mirrors `MySQLDeliverySettings`).

**Files changed:**
- `app/shared/domain/permissions.ts` — add `module.shelfguide` + `admin.shelfguide_settings`, and `/shelfguide` → `module.shelfguide` route mapping.
- `app/(authenticated)/page.tsx` — add the Shelf Guide home card.
- `app/(authenticated)/admin/page.tsx` — add the Shelf Guide tab.
- `app/(authenticated)/admin/ShelfGuideSettingsCard.tsx` — **new** admin card.
- `app/(authenticated)/admin/api/settings/route.ts` — add `shelfguide_default_location_id` (GET + PUT).
- `container.ts` — add two factory functions.
- `scripts/seed-app-bootstrap.sql` — optionally add `module.shelfguide` to the seeded Staff role.

**DB:** no new tables/columns. One new `app_settings` key `shelfguide_default_location_id` (lazy upsert).

## Decisions

- **Resolved by developer (brainstorm Q&A):**
  - Sales-velocity / share guide (not literal facings).
  - Recency-weighted half-life daily rate.
  - New module + own permission.
  - Location filter lists **all active locations** (single-select; default = configured selling area).
- **Resolved by AI (PRD/CLAUDE.md/pattern):**
  - Module id `shelfguide`, route `/shelfguide`, permission `module.shelfguide`; admin permission `admin.shelfguide_settings` — follows the one-permission-per-module / one-per-admin-tab convention.
  - `HALF_LIFE_DAYS = 14`, ABC thresholds `50%`/`80%` — code constants (YAGNI; not admin-configurable).
  - No chart library — all bars are token-styled divs (matches existing progress-bar pattern and avoids a dependency). Pie → A/B/C velocity bar distribution (readability).
  - Single client page + `?supplierId=` drill-down (shared location/date controls) rather than a dynamic route with duplicated controls.
  - Two GET endpoints (overview + detail); detail recomputes supplier share via a shared aggregation helper.
  - Self-heal injected through a narrow `SalesDaysEnsurer` port satisfied by the existing `MySQLSalesRollupRepository` (structural typing — no refactor of replenishment).
  - Default-location setting read inside `MySQLShelfGuideRepository` (mirrors `MySQLDeliverySettings`, which already reads `app_settings` directly).
- **Assumptions:**
  - Quantities are base units ("pcs"); no unit symbol shown (the user's spec is pcs).
  - Seeded **Staff** role is **unchanged** — admins grant `module.shelfguide` as needed (Administrator gains it automatically via the full-catalog resolution).
  - Client computes the default 30-day range using the device clock (Manila devices).

## Implementation Steps

1. **RBAC catalog + route guard** — `app/shared/domain/permissions.ts`
   - Add `| "module.shelfguide"` to `PermissionKey`'s module group and `| "admin.shelfguide_settings"` to the admin group.
   - Add catalog entries: `{ key: "module.shelfguide", label: "Open Shelf Guide" }` under "Module Access", and `{ key: "admin.shelfguide_settings", label: "Shelf Guide Settings" }` under "Admin Tabs".
   - Add `{ prefix: "/shelfguide", permission: "module.shelfguide" }` to `MODULE_ROUTE_PERMISSIONS`.
   - No other change — `middleware.ts` already resolves via `requiredPermissionForPath`, and the Administrator role auto-gains via `resolveUserPermissions` (`ALL_PERMISSION_KEYS`).

2. **Domain types + pure functions**
   - `app/(authenticated)/shelfguide/domain/ShelfGuide.ts`: define `TopItem`, `ShelfGuideSupplier`, `ShelfGuideOverview`, `ShelfGuideItem`, `ShelfGuideDetail` (shapes exactly as §7 of the PRD).
   - `app/(authenticated)/shelfguide/domain/weighting.ts`:
     - `HALF_LIFE_DAYS = 14`, `ABC_A = 0.5`, `ABC_B = 0.8`.
     - `halfLifeWeight(ageDays): number` = `0.5 ** (ageDays / HALF_LIFE_DAYS)`.
     - `daysBetween(from: string, to: string): number` (string dates, UTC math, mirroring `MySQLSalesRollupRepository`'s date-string approach).
     - `aggregateSales(rows, from, to)` → `{ suppliers: SupplierAgg[], grandTotalSold }` where `SupplierAgg` carries per-item `{ code, description, totalSold, dailyRate }`; computes `dailyRate` via the weighted formula and sorts suppliers by `totalSold` desc.
     - `assignAbcTiers(items)` → ABC letter per item by cumulative share of supplier total.
     - `toOverview(...)` / `toDetail(...)` mappers producing the DTOs (1-decimal rounding on `sharePercent`, `allocationPercent`, `dailyRate`).
   - `app/(authenticated)/shelfguide/domain/ShelfGuideRepository.ts`: ports
     ```ts
     interface ShelfGuideSaleRow { itemId; code; description; supplierId; supplierName; saleDate; unitsSold; }
     interface ShelfGuideRepository {
       getSalesByItem(locationId, from, to): Promise<ShelfGuideSaleRow[]>;
       getFirstActiveLocationId(): Promise<number | null>;
       getDefaultLocationId(): Promise<number | null>;
     }
     interface SalesDaysEnsurer { ensureDaysExist(locationId, from, to): Promise<void>; }
     ```

3. **Application use cases**
   - `GetShelfGuideOverviewUseCase` — deps `(ShelfGuideRepository, SalesDaysEnsurer)`. `execute({ locationId?, from, to })`: resolve location (`locationId ?? repo.getDefaultLocationId() ?? repo.getFirstActiveLocationId()`); if still null → return empty overview (`locationId: null`). Else `ensurer.ensureDaysExist`, `repo.getSalesByItem`, `aggregateSales`, return overview incl. resolved `locationId` + `defaultLocationId`.
   - `GetShelfGuideDetailUseCase` — same deps; `execute({ supplierId, locationId?, from, to })`: same resolution, then find the supplier in `aggregateSales(...).suppliers`; `null` if not found; map to `ShelfGuideDetail` (items sorted by `dailyRate` desc, `rank` assigned, ABC badges).

4. **Infrastructure adapter** — `app/(authenticated)/shelfguide/infrastructure/MySQLShelfGuideRepository.ts`
   - Implements `ShelfGuideRepository` with `pool.query` (mysql2), `activeoneSchemaName()`.
   - `getSalesByItem`: single query joining `item_sales_daily isd` → `item it` (`INACTIVE = 0`) → `contact c` (`c.ID = it.PREFERRED_VENDOR_ID`); filter `isd.location_id = ?`, `isd.sale_date BETWEEN ? AND ?`, `isd.units_sold > 0`; select `it.ID item_id, it.CODE code, it.DESCRIPTION description, it.PREFERRED_VENDOR_ID supplier_id, c.NAME supplier_name, isd.sale_date, isd.units_sold`; order `c.NAME, it.DESCRIPTION, isd.sale_date`. Map `sale_date` through the `dateColumnToStr`-style conversion (copy the tiny helper or add a local one — reuse the pattern in `replenishment/infrastructure/dates.ts`).
   - `getDefaultLocationId`: `SELECT value FROM app_settings WHERE \`key\` = 'shelfguide_default_location_id'` → parse int or null.
   - `getFirstActiveLocationId`: `SELECT ID FROM {ao}.location WHERE INACTIVE = 0 ORDER BY NAME LIMIT 1` → id or null.

5. **Container wiring** — `container.ts`
   - Import the two use cases + `MySQLShelfGuideRepository`; add:
     - `createGetShelfGuideOverviewUseCase()` → `new GetShelfGuideOverviewUseCase(new MySQLShelfGuideRepository(), new MySQLSalesRollupRepository())`.
     - `createGetShelfGuideDetailUseCase()` → same deps.

6. **HTTP adapters**
   - `app/(authenticated)/shelfguide/api/route.ts` (GET): parse `from`/`to` (required, `YYYY-MM-DD`; reject `from > to` with 400), optional `locationId` (int > 0); call `createGetShelfGuideOverviewUseCase().execute(...)`; return JSON.
   - `app/(authenticated)/shelfguide/api/[supplierId]/route.ts` (GET): parse `supplierId` (int > 0, else 400), same date/location parsing; call detail use case; `404` when null. Note the dynamic segment param name — read `context.params.supplierId` (Next 15 async params).
   - No business logic in either handler.

7. **Client page** — `app/(authenticated)/shelfguide/page.tsx` (`"use client"`)
   - Top controls (shared across both views): location dropdown (fed by `GET /location/api?module=shelfguide&showAll=true`), From/To date inputs (default last 30 days), search input.
   - Overview view: fetch `/shelfguide/api?from&to&locationId`; render supplier cards — name, item count, share %, share bar (div width = `sharePercent%`), top-item sneak peek; client-side search by name. Use `useSearchParams()` for `supplierId`.
   - Detail view (`supplierId` present): fetch `/shelfguide/api/[supplierId]`; render dashboard header (supplier name · allocation % · top item · A/B/C distribution bar) and the item table sorted by `dailyRate` desc with progress bars, `allocationPercent`, `totalSold`, ABC `Badge`, rank; client-side search on code+description; back link returns to overview.
   - Follow the canonical reference for filterable list rows (`app/(authenticated)/history` list pages: button rows, `border-border bg-card`, `hover:bg-muted/50 motion-safe:active:scale-[0.99]`) and for date controls (`app/(authenticated)/replenishment/page.tsx` labeled `type-label text-muted-foreground` fields). All colors via semantic tokens; `type-data` for codes/mono.

8. **Admin tab + settings**
   - `app/(authenticated)/admin/api/settings/route.ts`: add `shelfguide_default_location_id` to the GET response (`shelfguide_default_location_id: raw ?? null`) and to PUT — validate integer > 0 (or null to clear), authorize under `admin.shelfguide_settings`, persist via `createUpdateAppSettingUseCase().execute("shelfguide_default_location_id", String(v))` (mirror the `replenishment_*` block).
   - `app/(authenticated)/admin/ShelfGuideSettingsCard.tsx` (new, mirrors `DeliverySettingsCard.tsx`): load locations via `/location/api?module=shelfguide&showAll=true` and current default via `/admin/api/settings`; a location dropdown + **Save** that PUTs the key.
   - `app/(authenticated)/admin/page.tsx`: add `has("admin.shelfguide_settings")` to `visibleTabs`, a `TabsTrigger` "Shelf Guide", and a `TabsContent` with the new card.

9. **Home card** — `app/(authenticated)/page.tsx`
   - Add to `MODULES`: `{ name: "Shelf Guide", description: "See how fast each supplier's items sell to allocate shelf space.", icon: LayoutGrid, route: "/shelfguide", active: true, permission: "module.shelfguide" }` (import `LayoutGrid` from lucide-react).

10. **Optional seed** — `scripts/seed-app-bootstrap.sql`
    - If floor staff should get the guide by default, add `UNION ALL SELECT 'module.shelfguide'` to the Staff `role_permission` insert (lines ~53–60). Administrator needs nothing (catalog-resolved). Flag as optional — leave unchanged to let admins grant it explicitly.

11. **Verify** — `npx tsc --noEmit` + `npm run lint` (per CLAUDE.md: `next build` hangs in this environment; do not re-diagnose).

## Risks & Open Questions

- **Pie vs bars** — PRD replaces the requested pie with an A/B/C bar distribution; confirm with the developer before/at UI build.
- **Weighted-rate denominator** — the constant `Σ weight(d)` over all calendar days is new math; validate against a known flat-sales item (rate ≈ simple average) once live data is available.
- **Rollup freshness** — the guide depends on `item_sales_daily` being current for the selected location; self-heal covers missing days but a never-refreshed location still needs the nightly job/backfill.
- **`sale_date` conversion** — copy the `dateColumnToStr` approach rather than `toISOString()` on a `Date` to avoid TZ off-by-one (same caveat documented in `MySQLSalesRollupRepository`).
- **Staff seed** — whether the guide should be on by default for Staff (step 10) is a product call, not technical.
- **Large suppliers** — accepted for v1 (no pagination); revisit if a single supplier has thousands of sold items.
