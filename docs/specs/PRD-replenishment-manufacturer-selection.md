# PRD: Replenishment Manufacturer Selection Step

Date: 2026-07-18

## 1. Overview

Add a **manufacturer selection step** to the replenishment selection chain, immediately after supplier selection: `location → supplier → manufacturer → run`. The step is a new self-contained shared selection module at `/manufacturer` that mirrors the existing `/location` and `/supplier` pattern. It lists every manufacturer carried by the selected suppliers, **grouped per supplier**, all checked by default, and appends the selection to the run URL. The replenishment run (both Standard and Stockout tabs) then filters to the selected manufacturers. This lets a buyer scope a run down to specific brands without changing the supplier selection.

## 2. Goals

- Let the buyer narrow a replenishment run to specific manufacturers after picking suppliers, defaulting to **all manufacturers** so the step is a no-op tap for anyone who wants everything.
- Selection is **per-supplier**: the buyer can include a manufacturer for one supplier but exclude it for another.
- The filter applies to **both** the Standard and Stockout tabs of the run.
- Follow existing conventions exactly: four-layer module, shared selection-tile UI, chain URL threading, semantic tokens, server-side enforcement.
- Backward-compatible: existing links/bookmarks that carry only `locationId` + `supplierIds` (no manufacturer param) behave exactly as today (all manufacturers).

## 3. Non-Goals

- **No admin/persisted configuration** — the selection is per-run, carried in the URL only. No `app_settings` key, no schema change.
- **No new manufacturer entity in our tables** — manufacturers are read live from the ActiveOne `manufacturer` table; nothing is written back.
- **No change to the existing in-run manufacturer sub-grouping** or the per-manufacturer order-period selectors — those stay; the filter only controls which sub-groups are present.
- **No manufacturer step for Stockout's own entry** — Stockout has no separate selection chain; it reuses the same `locationId` + `supplierIds` + `manufacturerIds` already on the run URL. (Note: contrary to the older CLAUDE.md wording, Stockout is in fact **scoped to the same selected suppliers** as Standard — its query filters `PREFERRED_VENDOR_ID IN (supplierIds)`.)
- **Not surfacing manufacturers that have no items for the selected suppliers** — the list is derived from the suppliers' active items only.

## 4. Users & Roles

- Same users who run replenishment. The `/manufacturer` route is gated by **`module.replenishment`** (matching the run it feeds), enforced in `middleware.ts` via `MODULE_ROUTE_PERMISSIONS`. (Alternative — session-only, like `/supplier`/`/location` — noted in Open Questions.)
- No new permission key is introduced.

## 5. Functional Requirements

**Chain & routing**
- **FR-1** A new authenticated route `/manufacturer` renders a per-supplier manufacturer multi-select screen.
- **FR-2** The chain is rewired so supplier's `returnTo` points to `/manufacturer`, and `/manufacturer`'s `returnTo` points to the run:
  - `/location?module=replenishment&returnTo=<enc /supplier?returnTo=<enc /manufacturer?returnTo=%2Freplenishment>>`
  - After supplier: `/manufacturer?returnTo=%2Freplenishment&locationId={id}&supplierIds={csv}`
  - After manufacturer: `/replenishment?locationId={id}&supplierIds={csv}&manufacturerIds={sel}`
- **FR-3** `/manufacturer` requires `returnTo` and `supplierIds` query params. Missing either → in-place error message (mirroring `/supplier`'s missing-`returnTo` guard).
- **FR-4** On Continue, the screen appends `manufacturerIds` to `returnTo` and **preserves all other incoming params** (e.g. `locationId`), excluding `returnTo` and its own `manufacturerIds`/`supplierIds` handling — reusing `/supplier`'s param-forwarding approach.
- **FR-5** The replenishment run's existing redirect guard is unchanged in spirit: missing `locationId` → location chain; `locationId` present but `supplierIds` missing → `/supplier` (whose `returnTo` now routes through `/manufacturer`). **`manufacturerIds` is optional** — its absence means "all manufacturers, no filter"; the run does **not** redirect to `/manufacturer` when it is absent.

**Manufacturer list**
- **FR-6** The list contains every manufacturer whose **active** items (`item.INACTIVE = 0`) are supplied by a selected supplier (`item.PREFERRED_VENDOR_ID IN (supplierIds)`), i.e. `DISTINCT item.MANUFACTURER_ID` joined to `manufacturer.NAME`. It is **location-independent**.
- **FR-7** Items with a null `MANUFACTURER_ID` are represented by a selectable **"No Brand"** tile (encoded as `nb`), grouped under each supplier that has such items.
- **FR-8** Manufacturers are **grouped by supplier** (supplier name as section header), each supplier's manufacturers sorted with **"No Brand" first, then alphabetically** — consistent with the run's `groupByMfg` ordering. Suppliers are ordered by name.
- **FR-9** All manufacturer tiles are **checked by default** on first load.

**Selection UI**
- **FR-10** The screen provides a **name search box** filtering manufacturer tiles across all supplier sections (case-insensitive, partial). Filtered-out tiles keep their checked/unchecked state.
- **FR-11** The screen provides a **per-supplier tri-state "select all/none"** toggle for each supplier section, plus a **global Select all / Clear all**.
- **FR-12** The **Continue button is disabled when zero manufacturers are selected** (mirrors `/supplier`). Its label reflects the count (e.g. "Continue (N selected)").
- **FR-13** The screen **pre-selects from an incoming `manufacturerIds` param** if present (round-trip editing via the run's "Change" link), mirroring how `/supplier` pre-selects from `supplierIds`. Absent incoming param → all checked (default).

**Encoding**
- **FR-14** The selection is encoded in `manufacturerIds` as a comma-separated list of **`mfgKey` tokens** `{supplierId}:{manufacturerId|nb}` (the same key format the run already uses: `` `${supplierId}:${manufacturerId ?? "nb"}` ``).
- **FR-15** When **every** manufacturer across all suppliers remains selected (the default), `manufacturerIds` is **omitted** from the URL entirely (= no filter). An explicit token list is emitted only for a strict subset.

**Run behavior — Standard tab**
- **FR-16** When `manufacturerIds` is present, the Standard run includes only items whose `(supplier_id, manufacturer_id)` pair matches a token in the list (`nb` matches null manufacturer). Absent → no filter.
- **FR-17** The filter is applied **server-side** in the Standard query (`GetReplenishmentGroupsUseCase` / `MySQLReplenishmentRepository.getGroups`) so the payload carries only selected manufacturers' items.
- **FR-18** All in-run aggregations computed **after** filtering: supplier header item counts, aggregate/per-manufacturer critical badges, estimated-spend totals, supplier tri-state checkbox, Expand/Collapse-All, and the sub-case ("<1 cs") surfacing operate only over the filtered set.

**Run behavior — Stockout tab**
- **FR-19** Stockout is scoped to the same `supplierIds` as Standard. When `manufacturerIds` is present, the Stockout run applies the **identical** per-supplier `(supplier_id, manufacturer_id)` pair filter as Standard (FR-16), server-side in the Stockout query (`GetStockoutCandidatesUseCase` / `MySQLStockoutRepository`). No flattening.
- **FR-20** Absent `manufacturerIds` → Stockout is unfiltered (today's behavior); otherwise unchanged.

**Run screen indicator**
- **FR-21** When a strict subset is active (`manufacturerIds` present), the run screen shows a small indicator (e.g. "Manufacturers: {selected} of {available}") with a **"Change"** link back to `/manufacturer`, carrying the current `locationId`, `supplierIds`, and `manufacturerIds` so the selection is pre-filled. Hidden when no filter is active.

## 6. Data Model

No schema changes. Reads only.

| Source | Fields used | Purpose |
|---|---|---|
| ActiveOne `item` | `ID`, `INACTIVE`, `PREFERRED_VENDOR_ID`, `MANUFACTURER_ID` | Which manufacturers each supplier carries |
| ActiveOne `manufacturer` | `ID`, `NAME` | Manufacturer display names |
| ActiveOne `contact` | `ID`, `NAME` | Supplier section headers |

**In-memory shape returned by `/manufacturer/api`** (per supplier):
- `supplierId: number`, `supplierName: string`
- `manufacturers: { manufacturerId: number | null; manufacturerName: string | null }[]` (null = "No Brand")

**URL token grammar (`manufacturerIds`)**: `token(,token)*` where `token = <supplierId>:<manufacturerId | "nb">`. Omitted entirely = "all".

## 7. API Contract

### New: `GET /manufacturer/api?supplierIds={csv}`
- **Auth:** session + `module.replenishment`.
- **Input:** `supplierIds` — comma-separated ActiveOne contact IDs (required).
- **Behavior:** resolves `createGetManufacturersForSuppliersUseCase()` from `container.ts`; returns manufacturers carried by those suppliers, grouped per supplier.
- **200 response:** `{ suppliers: { supplierId, supplierName, manufacturers: { manufacturerId, manufacturerName }[] }[] }`
- **400:** missing/empty `supplierIds`. **500:** query failure.
- Command-query: GET, no state change.

### Changed: `GET /replenishment/api`
- **New optional param:** `manufacturerIds` (token list per FR-14). When present, filter Standard candidates to matching `(supplier_id, manufacturer_id)` pairs (FR-16). Absent → unchanged.

### Changed: `GET /replenishment/stockout/api`
- **New optional param:** `manufacturerIds` (same token list). When present, apply the same per-supplier `(supplier_id, manufacturer_id)` pair filter as the Standard query (FR-19). Absent → unchanged.

## 8. UI/UX Flow

1. Buyer taps the **Replenishment** home card → run screen → (missing scope) redirected through **location → supplier**.
2. After choosing suppliers and tapping Continue, lands on **`/manufacturer`**:
   - Header "Select Manufacturers", "← Home" link, search box.
   - Per-supplier sections; each shows a tri-state select-all and manufacturer tiles ("No Brand" first, then alphabetical); **all checked**.
   - Global Select all / Clear all.
   - Sticky **Continue (N selected)** button, disabled at 0.
3. On Continue: if all still selected → navigate to run with **no** `manufacturerIds`; if a subset → navigate with the token list.
4. **Run screen (Standard):** shows only the selected manufacturers' sub-groups; if a subset is active, a "Manufacturers: N of M · Change" indicator appears. Switching to **Stockout** applies the same per-supplier manufacturer filter (Stockout uses the same suppliers).
5. **Change** link → returns to `/manufacturer` with the current selection pre-filled for editing.

Reduced-motion, semantic tokens, `SelectionTile`, 48px touch targets, and mono/type-role rules all per DESIGN.md — reuse `/supplier`'s components and layout wholesale.

## 9. Edge Cases & Error Handling

| Case | Behavior |
|---|---|
| No `manufacturerIds` in run URL (old bookmark / all selected) | No filter; identical to today. |
| `manufacturerIds` present but Continue-time all selected | Param omitted (FR-15); no filter. |
| Buyer clears all manufacturers | Continue disabled (FR-12); cannot proceed. |
| A selected supplier has no active items → no manufacturers | Its section is omitted (or shown empty); does not block Continue if other suppliers have manufacturers. |
| Supplier's items are all "No Brand" | Section shows only the "No Brand" tile. |
| Token references a supplier not in `supplierIds` (Standard or Stockout) | No matching sub-group; harmless no-op. |
| `/manufacturer` reached without `supplierIds` or `returnTo` | In-place error message; no fetch. |
| Manufacturer/item added between selection and run | Under "all" (omitted param) it's included; under an explicit subset it's excluded — acceptable (immediate transition). |
| `/manufacturer/api` failure | Screen shows error + Retry (mirror `/supplier`). |

## 10. Open Questions

- **Route gating:** gate `/manufacturer` with `module.replenishment` (chosen) vs session-only like `/supplier`/`/location`. Chosen because the step exists solely for replenishment; revisit if the module is ever reused elsewhere.

## 11. Out of Scope / Deferred

- Persisting a default manufacturer selection per user/role or in `app_settings`.
- A manufacturer selection step for a future standalone Stockout entry chain.
- Filtering the manufacturer list by location relevance or recent sales (deliberately using the simple "all carried by suppliers" list).
- Any change to PO generation/write-back, run history snapshots, or the in-run order-period/rounding controls.

## 12. Architecture Notes (implementation guidance)

New four-layer module `app/(authenticated)/manufacturer/` (mirroring `location`'s self-contained structure):
- `domain/ManufacturerRepository.ts` — port; `domain/Manufacturer.ts` — entity/type if needed.
- `application/GetManufacturersForSuppliersUseCase.ts` — orchestration.
- `infrastructure/MySQLManufacturerRepository.ts` — `DISTINCT` query over `item` + `manufacturer` + `contact`.
- `api/route.ts` — GET adapter, resolves use case from `container.ts`.
- `page.tsx` — client selection screen (reuse `/supplier` structure, `SelectionTile`).
- `layout.tsx` — mirror `/supplier`/`/location`.
- `container.ts` — add `createGetManufacturersForSuppliersUseCase()`.

Run-side changes (existing files): `ReplenishmentRepository` / `GetReplenishmentGroupsUseCase` / `MySQLReplenishmentRepository` gain an optional per-supplier manufacturer-pair filter; the Stockout repo/use case gain an optional flat manufacturer-ID (+ No-Brand) filter; both API routes parse `manufacturerIds`; `page.tsx` reads it, applies aggregation-after-filter, and renders the indicator + Change link. `middleware.ts` / `permissions.ts` add `/manufacturer` → `module.replenishment`.
