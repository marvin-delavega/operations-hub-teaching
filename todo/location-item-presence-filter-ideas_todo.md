# Location Item Presence Filter -- Feature Ideas

Captured 2026-08-25. Not yet scoped -- each Tier 1 item likely warrants its own
PRD before implementation.

Context: The replenishment run (Standard and Stockout) surfaces every active item
belonging to the selected suppliers, regardless of whether the selected location
(e.g. RCastillo) has ever carried the item. Items never stocked at a location
generate noise rows with no meaningful sales/on-hand data. The fix: **opt-in,
per-location** item-visibility filtering — when enabled for a location, only show
items that have OR did have presence there, where presence =
an `item_inventory` row for that item+location (even if ENDING_QUANTITY is now 0)
OR any sale history (`item_sales_daily`) at that location. Not all locations
behave this way (only RCastillo today), so the filter must be a configuration
toggle, default OFF, set per location in `/admin`.

## Tier 1 -- Highest value
- [ ] **Per-location "hide never-stocked items" toggle** -- app-owned config (e.g. a nullable boolean column on the existing `module_location_visibility` table, absent/NULL = OFF) with the toggle surfaced in `/admin` → Location visibility alongside the existing per-module visibility flags; replenishment reads resolve it per run location.
- [ ] **Filter Standard run to location-present items when toggled on** -- an EXISTS predicate on `item_inventory` (item+location) OR `item_sales_daily` (item+location) added to the enriched read query, gated on the toggle, removes never-stocked supplier items from the main list.
- [ ] **Same filter for Stockout path when toggled on** -- mostly implied by its sale-history gate, but inventory-row-without-sales items currently slip through; make presence explicit and consistent.
- [ ] **Apply the same filter to Worksheet full-catalog mode** (`worksheet=true`) -- the printable pre-order list should match what the live run shows; no point printing items the branch has never carried.

## Tier 2 -- Strong, moderate effort
- [ ] **Single shared "location presence" CTE** reused across Standard, Stockout, and Summary repositories -- one SQL fragment in infrastructure avoids three divergent copies of the same rule (DRY across the module's MySQL repositories).
- [ ] **Verify `item_inventory` semantics before relying on row existence** -- confirm with live data that zero-qty items keep their rows (vs. rows being purged); if purged, sale history alone becomes the fallback definition for "did have".

## Tier 3 -- Convenience / workflow
- [ ] **Hidden-count feedback** -- show a subtle caption ("N items of your suppliers hidden — never stocked at this location") so admins understand why familiar items are missing rather than suspecting a bug.
- [ ] **Escape hatch toggle** (optional, defer unless requested) -- a per-run "show all supplier items" switch in case edge-case ordering (e.g. first-time SKU intro at a branch) needs visibility.

## Suggested starting point

Tier 1 as one PRD: add the per-location toggle (admin UI + storage on
`module_location_visibility` via the idempotent ALTER pattern), define "presence"
once (inventory row OR sale history), then gate the EXISTS filter in Standard,
Stockout, and worksheet mode on that toggle. Do the Tier 2 data-semantics check
(zero-qty row retention) *before* implementation — it determines whether the
inventory-row half of the OR is trustworthy.
