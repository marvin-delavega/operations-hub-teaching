# Implementation Plan: Configurable Safety-Stock Service-Level Modes

Source: `todo/safety-stock-service-levels-ideas_todo.md`
Date: 2026-08-14

## Summary

Replace the boolean `replenishment_safety_stock` toggle with a three-mode setting — **Off / Fixed / Dynamic**. Fixed mode uses a user-set service level (1–100%, default 90) mapped to a Z-score; Dynamic mode computes a per-item z-score from the item's own daily-sales history, capped at a user-set max level (default 99%). The buffer is still `z × σ × √(leadTime)`, computed server-side; the client only needs to know "enabled or not" to show/hide the Safety column.

## Affected Areas

- `app/(authenticated)/replenishment/domain/ReplenishmentRepository.ts` — replace `safetyStock?: boolean` with `safetyStock?: SafetyStockConfig`
- `app/(authenticated)/replenishment/application/GetReplenishmentGroupsUseCase.ts` — pass config through
- `app/(authenticated)/replenishment/infrastructure/MySQLReplenishmentRepository.ts` — add `MAX`/`AVG` to the `daily_stats` CTE, drop `Z_SCORE`, mode-aware computation
- `app/(authenticated)/replenishment/infrastructure/normalInverseCdf.ts` — **new** inverse normal CDF helper
- `app/(authenticated)/replenishment/api/route.ts` — read 3 settings (+ legacy fallback), build config
- `app/(authenticated)/admin/api/settings/route.ts` — GET/PUT the three keys with validation
- `app/(authenticated)/admin/ReplenishmentSettingsCard.tsx` — segmented control + numeric inputs
- `app/(authenticated)/replenishment/page.tsx` — derive `safetyStockEnabled` from `mode !== "off"`

**No DB schema change** (history columns `safety_stock_units`/`safety_stock_percent` already exist). **No container change** (config passed at `execute()` time, not construction). **No `SeedReplenishmentRepository` change** (its `getGroups` already omits the optional param).

## Decisions

- **Resolved by developer:** mode = Off / Fixed / Dynamic; fixed level 1–100% default 90; dynamic max-level 1–99.99% default 99.
- **Resolved by AI:** Z-mapping via Acklam inverse-normal-CDF (arbitrary %). 90%→1.28, 95%→1.645, 99%→2.326.
- **Resolved by AI:** `avgDailyRate` = `AVG(daily_total)` (days-with-sales), same population as `STDDEV_SAMP`.
- **Resolved by AI:** `daily_stats` CTE computes `STDDEV_SAMP` + `AVG` + `MAX` whenever mode ≠ off (shared SQL).
- **Assumptions:** backward-compat read-time fallback (`mode` absent + legacy `"on"` → `fixed @ 90`); no server-side ceiling; stockout stays excluded.

## Implementation Steps

1. `domain/ReplenishmentRepository.ts` — add `SafetyStockMode` / `SafetyStockConfig`; change `safetyStock?: boolean` → `safetyStock?: SafetyStockConfig`.
2. `infrastructure/normalInverseCdf.ts` (new) — `inverseNormalCdf(p)` via Acklam; clamp `p` to `(0, 0.999999)`.
3. `infrastructure/MySQLReplenishmentRepository.ts` — drop `Z_SCORE`; add `avg_daily_sales`/`max_daily_sales` to `CandidateRow`, CTE, SELECT; mode-aware post-processing.
4. `application/GetReplenishmentGroupsUseCase.ts` — `safetyStock?: SafetyStockConfig`.
5. `api/route.ts` — read mode/level/maxLevel + legacy fallback; build config.
6. `admin/api/settings/route.ts` — GET/PUT the three keys with validation.
7. `admin/ReplenishmentSettingsCard.tsx` — segmented control + numeric inputs.
8. `page.tsx` — `safetyStockEnabled = mode !== "off"`.
9. Verify — `npx tsc --noEmit` + `npm run lint`.

## Risks & Open Questions

- Inverse-CDF accuracy (Acklam ~1e-9) — adequate for 1–99.99%.
- `AVG` vs `units_sold/days` mismatch — one-line swap if full-span is preferred.
- Legacy-key fallback leaves `replenishment_safety_stock` in `app_settings` (never rewritten).
- Percentage display when suggested = 0 — pre-existing, unaffected.
