# Implementation Plan: Replenishment Location Item-Presence Filter

Source PRD: [PRD-replenishment-location-item-presence-filter.md](./PRD-replenishment-location-item-presence-filter.md)
Date: 2026-08-25

## Summary

Add a **per-location, opt-in** filter that hides replenishment items which have
never had stock (`item_inventory` row) or sales (`item_sales_daily`) at the run
location (+ mapped selling areas). Stored as an `app_settings` dynamic key
(`replenishment_item_presence_filter:{locationId}`), configured via a new switch
column in `/admin` → Location visibility, enforced server-side in the Standard
candidates SQL (covering worksheet mode too). Stockout needs no change.

## Affected Areas

- **replenishment**: [domain/ReplenishmentRepository.ts](../../app/(authenticated)/replenishment/domain/ReplenishmentRepository.ts), [application/GetReplenishmentGroupsUseCase.ts](../../app/(authenticated)/replenishment/application/GetReplenishmentGroupsUseCase.ts), [infrastructure/MySQLReplenishmentRepository.ts](../../app/(authenticated)/replenishment/infrastructure/MySQLReplenishmentRepository.ts), [infrastructure/SeedReplenishmentRepository.ts](../../app/(authenticated)/replenishment/infrastructure/SeedReplenishmentRepository.ts), [api/route.ts](../../app/(authenticated)/replenishment/api/route.ts)
- **admin**: [domain/AppSettingsRepository.ts](../../app/(authenticated)/admin/domain/AppSettingsRepository.ts), [infrastructure/MySQLAppSettingsRepository.ts](../../app/(authenticated)/admin/infrastructure/MySQLAppSettingsRepository.ts), [infrastructure/SeedAppSettingsRepository.ts](../../app/(authenticated)/admin/infrastructure/SeedAppSettingsRepository.ts), two new application use cases, one new API route, [LocationVisibilityManager.tsx](../../app/(authenticated)/admin/LocationVisibilityManager.tsx)
- **shared**: new tiny constant module for the setting-key convention
- **container.ts**: two new factories
- **DB**: **no schema change** — `app_settings` keys are dynamic (same pattern as `delivery_continuous_scanning`)

## Decisions

- Resolved by AI: **storage = `app_settings` dynamic key**, value `"on"`/`"off"` — no schema change; matches every other boolean setting's convention (`UpdateAppSettingUseCase` has no delete, so write `"off"` rather than deleting).
- Resolved by AI: **toggle lives in the Location visibility tab** — it is the only per-location admin surface ([LocationVisibilityManager.tsx](../../app/(authenticated)/admin/LocationVisibilityManager.tsx) already renders a per-module location grid with switches).
- Resolved by AI: **presence includes selling-area sale history** — pooled shelf demand legitimately surfaces items on the feeder run (mirrors the `sold` CTE's location set). Inventory-row check stays at the run location only (pooling PRD excludes selling-area stock from effective available).
- Resolved by AI: **permission = `admin.location_visibility`** — the tab that owns the control (the existing hidden-flag POST in [admin/api/route.ts](../../app/(authenticated)/admin/api/route.ts) also accepts `admin.replenishment_settings`; keep the stricter single-permission gate for the new route).
- Resolved by AI: **Stockout untouched** — its ≥1-sale-at-run-location gate already implies presence (PRD FR-6).
- Assumption: **filter overrides `showAllItems`/worksheet expansion** once enabled (PRD FR-3) — presence is a hard location policy.
- Assumption: **SeedReplenishmentRepository accepts the new flag and ignores it** — seed data has no real presence semantics; it only serves pre-DB-configuration dev.

## Implementation Steps

### 1. Shared key convention — `app/shared/domain/presenceFilterSetting.ts` (new)

```ts
export const PRESENCE_FILTER_KEY_PREFIX = "replenishment_item_presence_filter:";
export function presenceFilterSettingKey(locationId: number): string {
  return `${PRESENCE_FILTER_KEY_PREFIX}${locationId}`;
}
```

Single source of truth — imported by both the admin endpoints and the replenishment API route.

### 2. Admin domain port — [AppSettingsRepository.ts](../../app/(authenticated)/admin/domain/AppSettingsRepository.ts)

Add one method:

```ts
getByPrefix(prefix: string): Promise<Record<string, string>>;
```

### 3. Admin infrastructure — [MySQLAppSettingsRepository.ts](../../app/(authenticated)/admin/infrastructure/MySQLAppSettingsRepository.ts)

Implement `getByPrefix` with `SELECT \`key\`, value FROM app_settings WHERE \`key\` LIKE ?` (param `${prefix}%`), reducing rows to a `Record<string,string>`. Mirror in [SeedAppSettingsRepository.ts](../../app/(authenticated)/admin/infrastructure/SeedAppSettingsRepository.ts) (return `{}`).

### 4. Admin application — two new use cases

- `application/GetLocationPresenceFiltersUseCase.ts`: `execute(): Promise<Record<number, boolean>>` — calls `repository.getByPrefix(PRESENCE_FILTER_KEY_PREFIX)`, maps each key's numeric suffix → `value === "on"`.
- `application/SetLocationPresenceFilterUseCase.ts`: `execute(locationId: number, enabled: boolean)` — validates positive integer (fail fast), writes `presenceFilterSettingKey(locationId)` → `"on" | "off"` via `AppSettingsRepository.set`.

### 5. Container — [container.ts](../../container.ts)

Add `createGetLocationPresenceFiltersUseCase()` and `createSetLocationPresenceFilterUseCase()`, wiring `MySQLAppSettingsRepository` (follow the `createGetAppSettingUseCase` block style).

### 6. Admin API — `app/(authenticated)/admin/api/location-presence-filter/route.ts` (new)

Follow the shape of [order-pooling/route.ts](../../app/(authenticated)/admin/api/order-pooling/route.ts):

- `GET`: `requirePermission("admin.location_visibility")` → `{ filters: Record<locationId, boolean> }`.
- `PUT`: same permission; body `{ locationId, enabled }`; validate types (400 otherwise) → `SetLocationPresenceFilterUseCase`; return `{ ok: true }`.

### 7. Replenishment API — [api/route.ts](../../app/(authenticated)/replenishment/api/route.ts)

After the location lookup (~line 48):

```ts
const requireItemPresence =
  (await createGetAppSettingUseCase().execute(presenceFilterSettingKey(locationId))) === "on";
```

Pass as a new trailing argument to `createGetReplenishmentGroupsUseCase().execute(...)`. The client sends no flag — server-resolved policy (PRD FR-8).

### 8. Replenishment domain + application pass-through

- [ReplenishmentRepository.ts](../../app/(authenticated)/replenishment/domain/ReplenishmentRepository.ts): new trailing optional param `requireLocationPresence?: boolean` with a doc comment ("When true, only items with an inventory row or rollup sale at the run location / its selling areas are returned").
- [GetReplenishmentGroupsUseCase.ts](../../app/(authenticated)/replenishment/application/GetReplenishmentGroupsUseCase.ts): accept + forward.
- [SeedReplenishmentRepository.ts](../../app/(authenticated)/replenishment/infrastructure/SeedReplenishmentRepository.ts): accept + ignore (assumption above).

### 9. Standard SQL — [MySQLReplenishmentRepository.ts](../../app/(authenticated)/replenishment/infrastructure/MySQLReplenishmentRepository.ts)

- `buildCandidatesSQL(...)` gains a `requireLocationPresence: boolean` param. When true, extend the final `WHERE` (after the sales-gate / worksheet branch at lines ~206–208, **before** `${manufacturerClause}`) with:

```sql
AND (
  EXISTS (
    SELECT 1 FROM ${ao}.item_inventory pf_inv
    WHERE pf_inv.ITEM_ID = si.item_id AND pf_inv.LOCATION_ID = ?
  )
  OR EXISTS (
    SELECT 1 FROM item_sales_daily pf_sd
    WHERE pf_sd.item_id = si.item_id AND pf_sd.location_id IN (?)
  )
)
```

The `IN (?)` reuses mysql2 array expansion via `pool.query` (already the pattern here) with `soldLocationIds` — identical to the `sold` CTE's location set, so pooling-aware runs treat feeder + selling-area sales as presence (PRD FR-2).

- **Param ordering (critical):** the presence placeholders occur in the SQL text *before* the `manufacturerClause` placeholders, so in `getGroups` push a `presenceParams` array (`[locationId]` or `[locationId, soldLocationIds]`) into `params` **before** `params.push(...mfgParams)` (line ~272). Both branches (with/without selling areas) need this splice.
- Worksheet mode needs no extra work — it flows through the same builder (PRD FR-4).

### 10. Admin UI — [LocationVisibilityManager.tsx](../../app/(authenticated)/admin/LocationVisibilityManager.tsx)

- On mount, additionally `fetch("/admin/api/location-presence-filter")` → `filtersByLocation` state.
- In the `replenishment` module card's table, add a second switch column labeled **"Hide never-stocked items"** (header + cell). Cell switch reflects `filtersByLocation[l.id] ?? false`; toggling PUTs `{ locationId, enabled }` with per-row saving state and revert-on-failure — copy the existing `toggleVisibility` interaction exactly.
- Non-replenishment module cards render no such column (the setting is replenishment-owned).

### 11. No other changes

Stockout repositories/use-cases/routes untouched (PRD FR-6). PO generation, review screen, summary badge repositories untouched — they consume repository output downstream of the filter.

## Verification

Per CLAUDE.md (local `next build` hangs — environment issue, do not re-diagnose):

1. `npx tsc --noEmit`
2. `npm run lint`
3. Manual (`npm run dev`): toggle ON for RCastillo → Standard list drops never-stocked supplier items; worksheet print shows the same reduction; toggle OFF → output identical to today; Stockout list unchanged either way; non-admin (lacking `admin.location_visibility`) gets 403 on the new route.

## Risks & Open Questions

- **`item_inventory` performance:** the EXISTS probes a large ActiveOne table. Verify an index lead exists on `(LOCATION_ID, ITEM_ID)` (or rely on the existing `ITEM_ID` leading indexes the other CTEs already use) and check `EXPLAIN` against live data before shipping.
- **Zero-qty row retention:** the inventory-row half of the OR assumes ActiveOne keeps `item_inventory` rows after quantity reaches 0. Confirm on live data; if rows are purged, sale history alone carries "did have" (definition still correct, just narrower).
- **First-time SKU introduction:** newly introduced items stay hidden until first receipt/sale at that location (accepted trade-off in PRD Edge Cases) — surface this to the developer during UAT.
