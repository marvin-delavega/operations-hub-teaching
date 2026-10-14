# Implementation Plan: Replenishment Manufacturer Selection Step

Companion to `PRD-replenishment-manufacturer-selection.md`. All signatures/paths verified against the current code. No open forks.

## Summary of decisions (final)
- New four-layer module `app/(authenticated)/manufacturer/` = chain step between `/supplier` and `/replenishment`.
- List = manufacturers carried by the selected suppliers' active items (`DISTINCT`), grouped per supplier, "No Brand" (null) first then alphabetical, all checked by default.
- Encoding: `manufacturerIds` = comma-separated `mfgKey` tokens `{supplierId}:{manufacturerId|nb}`. Omitted entirely = all (no filter).
- **Both** Standard and Stockout filter by the **same** per-supplier `(supplier_id, manufacturer_id)` pairs, **server-side**. (Stockout is already scoped to the same `supplierIds`.)
- Gate `/manufacturer` with `module.replenishment`.
- Run-screen indicator "N of M · Change" when a subset is active; M fetched from `/manufacturer/api`.

## Shared helper (do first)
Add a small pure parser/serializer for the token list so client + server agree. Put it in the manufacturer module's domain (or reuse the run's existing `mfgKey`/`mfggroup` conventions):
- `parseManufacturerTokens(param: string | null): { supplierId: number; manufacturerId: number | null }[] | null` — returns `null` when the param is absent/empty (= no filter). `nb` → `manufacturerId: null`.
- `serializeManufacturerTokens(pairs): string` — inverse.
- Reuse the existing token shape `${supplierId}:${manufacturerId ?? "nb"}` already used by `mfgKey` in `replenishment/page.tsx`.

## Part A — New `/manufacturer` module

1. **`domain/Manufacturer.ts`** — types: `Manufacturer { manufacturerId: number | null; manufacturerName: string | null }`, `SupplierManufacturers { supplierId: number; supplierName: string; manufacturers: Manufacturer[] }`.
2. **`domain/ManufacturerRepository.ts`** — port: `getManufacturersForSuppliers(supplierIds: number[]): Promise<SupplierManufacturers[]>`.
3. **`infrastructure/MySQLManufacturerRepository.ts`** — implements the port. Query:
   - `SELECT DISTINCT it.PREFERRED_VENDOR_ID AS supplier_id, c.NAME AS supplier_name, it.MANUFACTURER_ID AS manufacturer_id, mfr.NAME AS manufacturer_name FROM item it JOIN contact c ON c.ID = it.PREFERRED_VENDOR_ID LEFT JOIN manufacturer mfr ON mfr.ID = it.MANUFACTURER_ID WHERE it.INACTIVE = 0 AND it.PREFERRED_VENDOR_ID IN (?) ORDER BY c.NAME, (it.MANUFACTURER_ID IS NULL) DESC, mfr.NAME`
   - Build `IN (?)` placeholders from `supplierIds.length` (mirror `MySQLStockoutRepository` placeholder pattern). Group rows into `SupplierManufacturers[]`.
4. **`application/GetManufacturersForSuppliersUseCase.ts`** — `execute(supplierIds): Promise<SupplierManufacturers[]>` delegating to the repo.
5. **`api/route.ts`** — `GET`: read `supplierIds` (csv → positive ints; 400 if empty), resolve `createGetManufacturersForSuppliersUseCase()`, return `{ suppliers: SupplierManufacturers[] }`. HTTP-only, no logic (mirror `/supplier/api/route.ts`).
6. **`page.tsx`** — client screen, mirror `/supplier/page.tsx` structure:
   - Read `returnTo` (required), `supplierIds` (required), `manufacturerIds` (optional pre-select). Missing `returnTo`/`supplierIds` → in-place error.
   - Fetch `/manufacturer/api?supplierIds=...`. Render per-supplier sections, each a `SelectionTile` grid; "No Brand" tile for null.
   - State: `Set<string>` of selected `mfgKey`s. Default = all tiles checked (unless incoming `manufacturerIds` pre-selects a subset).
   - Search box (filter tiles by manufacturer name, case-insensitive; filtered-out keep state). Per-supplier tri-state select-all; global Select all / Clear all.
   - Sticky **Continue (N selected)**, disabled at 0.
   - `handleContinue`: if all tiles selected → navigate to `returnTo` with **no** `manufacturerIds`; else append `manufacturerIds=<serialized subset>`. **Preserve all incoming params except `returnTo` and `manufacturerIds`** (i.e. keep `locationId` AND `supplierIds`) — differs from `/supplier` which strips `supplierIds`.
   - Wrap in `<Suspense>` like `/supplier`.
7. **`layout.tsx`** — mirror `app/(authenticated)/supplier/layout.tsx`.

## Part B — Wire the container
8. **`container.ts`** — add `createGetManufacturersForSuppliersUseCase(): GetManufacturersForSuppliersUseCase` returning `new GetManufacturersForSuppliersUseCase(new MySQLManufacturerRepository())`. Add imports.

## Part C — Access control
9. **`app/shared/domain/permissions.ts`** — add `{ prefix: "/manufacturer", permission: "module.replenishment" }` to `MODULE_ROUTE_PERMISSIONS`. (No new permission key.) Middleware picks this up automatically via `requiredPermissionForPath`.

## Part D — Chain wiring (replenishment redirect)
10. **`replenishment/page.tsx`** redirect effect (~lines 418–431): insert the manufacturer step.
    - `!locationId` → `/location?module=replenishment&returnTo=` + `encodeURIComponent("/supplier?returnTo=" + encodeURIComponent("/manufacturer?returnTo=" + encodeURIComponent("/replenishment")))`.
    - `!supplierIdsParam` (locationId present) → `/supplier?returnTo=${encodeURIComponent("/manufacturer?returnTo=" + encodeURIComponent("/replenishment"))}&locationId=${locationId}`.
    - **Do not** redirect when `manufacturerIds` is absent (absent = all).
    - The `ReplenishmentWidget` quick-jump link (`/replenishment?locationId=..&supplierIds=..`) stays as-is → no `manufacturerIds` = all manufacturers.

## Part E — Standard run: server-side filter
11. **`domain/ReplenishmentRepository.ts`** — add optional param to `getGroups(..., showAllItems?, manufacturerPairs?)` where `manufacturerPairs?: { supplierId: number; manufacturerId: number | null }[]` (undefined/empty = no filter).
12. **`application/GetReplenishmentGroupsUseCase.ts`** — `execute(..., showAllItems=false, manufacturerPairs?)`; pass through to `repository.getGroups(...)`.
13. **`infrastructure/MySQLReplenishmentRepository.ts`** — when `manufacturerPairs` present, append to the final `WHERE` (currently `WHERE COALESCE(sd.units_sold,0) > 0`) an OR-group of pair predicates: for each pair `(si.supplier_id = ? AND si.MANUFACTURER_ID = ?)`, or `(si.supplier_id = ? AND si.MANUFACTURER_ID IS NULL)` for `nb`. Wrap the OR-group in parens and AND it. Thread params in order. Keep `buildCandidatesSQL` param ordering consistent (document the added params in the header comment).
14. **`infrastructure/SeedReplenishmentRepository.ts`** — update the `getGroups` signature to match the interface and apply the same pair filter in-memory (so it compiles and behaves consistently in the seed path).
15. **`api/route.ts`** (`/replenishment/api`) — parse `manufacturerIds` via the shared parser; pass `manufacturerPairs` to the use case.
16. **Also return `manufacturerCount`?** Not needed here — M for the indicator comes from `/manufacturer/api` (step 20). No response-shape change.

## Part F — Stockout run: same server-side filter
17. **`domain/StockoutRepository.ts`** — `getCandidates(locationId, supplierIds, manufacturerPairs?)`.
18. **`application/GetStockoutCandidatesUseCase.ts`** — `execute(locationId, supplierIds, manufacturerPairs?)`; pass through.
19. **`infrastructure/MySQLStockoutRepository.ts`** — apply the identical pair-filter OR-group to its final `WHERE` (on `so.supplier_id` / `so.MANUFACTURER_ID`). Update the param header comment.
20. **`stockout/api/route.ts`** — parse `manufacturerIds`; pass `manufacturerPairs` to the use case.

## Part G — Run screen: pass param, indicator, Change link
21. **`replenishment/page.tsx`**:
    - Read `manufacturerIds` from `searchParams`; parse to pairs once.
    - `fetchGroups`: add `manufacturerIds` to the `/replenishment/api` query params when present. Add it to the `fetchGroups` `useCallback` deps.
    - `fetchStockoutCandidates`: add `manufacturerIds` to the `/replenishment/stockout/api` query when present.
    - Aggregations (FR-18) need **no** client changes — server already returns only allowed items, so counts/critical/spend/tri-state/expand and sub-case surfacing are correct as-is.
    - **Indicator + Change link:** when `manufacturerIds` present, show near the controls bar: `Manufacturers: {N} of {M} · Change`, where `N` = distinct tokens parsed, and `M` = total pairs from a one-time `fetch('/manufacturer/api?supplierIds='+supplierIdsParam)` (distinct supplier×manufacturer count). The **Change** link → `/manufacturer?returnTo=%2Freplenishment&locationId={id}&supplierIds={csv}&manufacturerIds={current}` (pre-fills selection). Hidden when no filter active. Style per DESIGN.md tokens; shared across both tabs.

## Part H — Verify
22. `npm run lint` + `npm run build` (Turbopack) — must pass (lint enforces token/mono/motion rules on the new screen).
23. Manual/`/run` walkthrough:
    - Chain: home → run → location → supplier → **manufacturer** (all checked) → Continue → run shows all (no `manufacturerIds` in URL).
    - Deselect a manufacturer for one supplier → Continue → URL has `manufacturerIds`; Standard hides only that supplier's sub-group; other suppliers' same manufacturer unaffected; supplier header counts/critical/spend reflect the filtered set.
    - Switch to Stockout → same filter applied per supplier.
    - Indicator shows "N of M"; Change link round-trips with selection pre-filled.
    - Clear all → Continue disabled.
    - Old bookmark `/replenishment?locationId&supplierIds` (no `manufacturerIds`) → unchanged (all manufacturers).
    - Non-replenishment user hitting `/manufacturer` → redirected by middleware.

## Files touched
**New:** `manufacturer/domain/Manufacturer.ts`, `manufacturer/domain/ManufacturerRepository.ts`, `manufacturer/application/GetManufacturersForSuppliersUseCase.ts`, `manufacturer/infrastructure/MySQLManufacturerRepository.ts`, `manufacturer/api/route.ts`, `manufacturer/page.tsx`, `manufacturer/layout.tsx` (+ token parser helper).
**Edited:** `container.ts`, `app/shared/domain/permissions.ts`, `replenishment/page.tsx`, `replenishment/domain/ReplenishmentRepository.ts`, `replenishment/application/GetReplenishmentGroupsUseCase.ts`, `replenishment/infrastructure/MySQLReplenishmentRepository.ts`, `replenishment/infrastructure/SeedReplenishmentRepository.ts`, `replenishment/api/route.ts`, `replenishment/domain/StockoutRepository.ts`, `replenishment/application/GetStockoutCandidatesUseCase.ts`, `replenishment/infrastructure/MySQLStockoutRepository.ts`, `replenishment/stockout/api/route.ts`.
