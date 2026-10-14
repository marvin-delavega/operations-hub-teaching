# PRD: Replenishment Location Item-Presence Filter

Source idea capture: [todo/location-item-presence-filter-ideas_todo.md](../../todo/location-item-presence-filter-ideas_todo.md)
Date: 2026-08-25
Module: `replenishment` (+ `/admin` config surface)
Status: Draft

## Background & Problem

Some locations (e.g. **RCastillo**) have never carried many of the items that belong
to their selected suppliers. The Standard replenishment run surfaces every active
item of those suppliers regardless of whether the run location has ever stocked
them, producing noise rows with no meaningful on-hand or sales data. The printable
Worksheet (full-catalog mode) prints the same noise on paper.

Not all locations behave this way — this must be **opt-in per location**, not a
global behavior change.

## Goals

- Let admins enable, per location, a filter that hides replenishment items that
  have **never** had stock or sales at that location.
- Default OFF everywhere; enabling it changes nothing except at that location's runs.

## Non-Goals

- No change to Stockout candidate logic (see FR-6 — it is already compliant).
- No change to suggestion math, DOS, pooling, rounding, or PO generation.
- No per-item overrides (only ever-stock / never-stock granularity).

## Functional Requirements

### FR-1 — Per-location toggle, default OFF

A new per-location setting controls the filter. Storage: `app_settings` dynamic
key **`replenishment_item_presence_filter:{locationId}`** (`"on"` = enabled;
absent or any other value = OFF). Follows the existing boolean-setting convention
(`delivery_continuous_scanning`, `replenishment_show_incoming`). **No schema
change** — `app_settings` keys are dynamic.

### FR-2 — Presence definition

An item is **present** at a location when EITHER:

1. Any ActiveOne `item_inventory` row exists for that item + run location (any
   batch / sequence — even if `ENDING_QUANTITY` is now `0`), OR
2. Any row exists in `item_sales_daily` for that item at the run location **or
   any of its mapped selling areas** (when demand pooling is active for the run,
   use the same location set as the run's `sold` CTE — feeder + mapped selling
   areas).

Rationale for including selling-area sales: pooled shelf demand legitimately
surfaces items on the feeder's run; such items must not be filtered out as
"never present".

### FR-3 — Standard run filtering

When the toggle is ON for the run location, the Standard candidates query excludes
non-present items. The predicate applies **always once enabled** — including when
the run-level "show all items" toggle (`replenishment_show_all_items`) is ON and
in worksheet mode. Presence is a location-level policy; per-request expansion
toggles do not override it. When OFF, behavior is byte-identical to today.

### FR-4 — Worksheet full-catalog mode

`worksheet=true` fetches share the same SQL builder, so the worksheet honors the
same filter. A printed worksheet for a filtered location contains only present
items.

### FR-5 — Zero-sales-but-present items remain governed by existing rules

The filter removes only *never-present* items. Present items with zero sales
remain subject to today's exclusions (`units_sold > 0` gate, `<1 cs` surfacing,
worksheet relaxation) exactly as before.

### FR-6 — Stockout path: no change

Stockout candidates already require ≥ 1 sale in `item_sales_daily` **at the run
location** — every stockout-surfaced item satisfies the presence definition by
construction. No code change; documented here so the invariant isn't accidentally
broken later.

### FR-7 — Admin configuration UI

`/admin` → **Location visibility** tab: inside the existing per-module location
table (module `replenishment`), a second switch column **"Hide never-stocked
items"** next to each location's visibility switch. Toggling saves the
`app_settings` key immediately (optimistic UI, saving state, revert on failure —
same interaction as the visibility switch).

Read/write endpoints:

- **GET** `/{admin}/api/location-presence-filter` — returns `{ filters: Record<locationId, boolean> }` for all locations (one query over `app_settings` keys with prefix `replenishment_item_presence_filter:`).
- **PUT** same path — body `{ locationId, enabled }`; validates positive integer + boolean; writes `"on"` / deletes (or writes `"off"`) via `UpdateAppSettingUseCase`.

Both gated by `requirePermission("admin.location_visibility")` (the tab owner),
matching where the control lives.

### FR-8 — Server-side enforcement

The filter resolves server-side in the replenishment GET (`api/route.ts`) from
`app_settings` — the client never passes a "filter me" flag. Command-Query
Separation holds: reads only.

## Edge Cases

- **Item with inventory row, zero qty, zero sales:** present → kept (subject to
  existing zero-sales exclusion rules).
- **Brand-new SKU being introduced at the branch:** hidden until its first
  `item_inventory` row or first sale exists at that location. Accepted trade-off;
  admins can turn the toggle off temporarily if they need to force-order into a
  brand-new branch.
- **Selling-area-only item (feeder rate 0, shelf rate > 0):** present via
  selling-area sales history → surfaced, per FR-2 rationale.
- **Toggle flipped mid-session:** next fetch reflects it (setting read per
  request, cached tag invalidated by the settings PUT like other settings).

## Acceptance Criteria

1. With the toggle OFF, Standard list, show-all-items mode, and worksheet output are identical to today.
2. With the toggle ON for location X, no item without an `item_inventory` row or sale history at X (or its selling areas) appears in any of those three surfaces.
3. Stockout list for X is unaffected by the toggle.
4. Toggle persists per location and survives restarts; each location independent.
5. A user without `admin.location_visibility` cannot change the toggle (403).
