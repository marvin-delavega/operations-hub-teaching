# Safety Stock — Configurable Service-Level Modes (Feature Ideas)

Captured 2026-08-14. Not yet scoped — each Tier 1 item likely warrants its own
PRD before implementation.

Context: Safety stock shipped with a hard-coded `Z_SCORE = 1.28` (90% service
level), gated by a single boolean `replenishment_safety_stock` toggle. That's
flat — volatile items get under-buffered, stable items over-buffered. The goal
is a three-mode setting: **Off**, **Fixed service level** (admin picks a level
%), and **Dynamic service level** (data-driven z-score from the item's own
sales history, capped by an admin-set max level).

## Tier 1 — Highest value (core)

- [ ] **Replace the boolean with a mode setting** — `replenishment_safety_stock_mode` ∈ `off | fixed | dynamic` (default `off`), replacing `replenishment_safety_stock`. Backward-compat: existing `"on"` → `fixed @ 90%`.
- [ ] **Fixed mode + service-level input** — numeric input 1–100% (default 90), mapped to Z via an inverse-normal-CDF function (Acklam approximation). Buffer = `Z(level) × σ × √(leadTime)`.
- [ ] **Dynamic mode + max-level cap** — `zScore = max(0, (maxDailyDemand − avgDailyRate) / σ)`, capped at `Z(maxLevel)` (default 99%). Needs `MAX` + `AVG` added to the existing `daily_stats` CTE. Buffer = `min(zScore, Z(maxLevel)) × σ × √(leadTime)`.
- [ ] **Admin settings UI** — segmented control (Off / Fixed / Dynamic) + conditional numeric inputs, replacing the `Switch`. Gated by `admin.replenishment_settings`.

## Tier 2 — Strong, moderate effort

- [ ] **Server-side ceiling + rounding consistency** — safety stock is a raw float at the server; the review edit uses `rawNeed × pct/100`. Reconcile the two paths.
- [ ] **History audit** — record mode + level + final z-score on `replenishment_run_line`.
- [ ] **Robust dynamic (percentile)** — 95th-percentile alternative to `maxDailyDemand` to dampen one-off promo spikes.

## Tier 3 — Convenience / workflow

- [ ] **Stockout path** — currently hard-excluded; decide if stockout ever gets a buffer.
- [ ] **Per-item / per-supplier override** of the global mode.

## Open questions

1. Max-level upper bound — 100% maps to an infinite Z; use a 99.99% ceiling (resolved: default 99%, allow 1–99.99%).
2. Service-level → Z — Acklam approximation (arbitrary %) vs preset dropdown.
3. Backward compat — existing `"on"` → `fixed @ 90%`.
4. Percentage display when suggested = 0 — carries over from the original doc.
5. `avgDailyRate` semantics — days-with-sales avg (consistent with σ) vs full-span `units_sold / days`.

## Suggested starting point

One PRD covering all of Tier 1 (mode + fixed + dynamic + admin UI + plumbing) —
one cohesive change touching the same ~5 files, and the CTE work is nearly free.
