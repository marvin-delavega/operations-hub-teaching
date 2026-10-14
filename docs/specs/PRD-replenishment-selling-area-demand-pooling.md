# PRD: Replenishment Selling-Area Demand Pooling
Date: 2026-06-30

## 1. Overview

Some locations (e.g. *LG Selling Area*) are display/selling floors fed by a warehouse (e.g. *Leon Garcia Warehouse*). Their physical on-hand counts are unreliable — reported bloated, sometimes by thousands of pieces — which makes their `effective_available` garbage and suppresses any sensible reorder suggestion, even though their register sales are accurate. This feature lets an admin designate such a location as a **selling area** mapped to a single **feeder** warehouse. The feeder's replenishment then **pools** the selling area's true off-take into the feeder's own demand, sized against the feeder's reliable stock, so the warehouse carries enough to keep both its wholesale customers and the shelf supplied — without ever ordering against the selling area's bad count.

## 2. Goals

- Capture a selling area's real register demand in replenishment without trusting its physical count.
- Size a **single pooled order at the feeder** = (feeder sales rate + mapped selling areas' sales rate) over the horizon, minus the feeder's own available — subtracting feeder stock exactly once (no double-count).
- Surface SKUs the warehouse never sells itself but the shelf does, so the warehouse begins stocking them.
- Make the pooled demand transparent on the replenishment screen via a dedicated breakdown column.
- Ride entirely on the existing `item_sales_daily` rollup — no schema change to the rollup, no transfer accounting.
- Ship safely: zero configuration means byte-for-byte today's behavior.

## 3. Non-Goals

- Does **not** replenish the selling area as its own target (it is a demand source, never an order destination).
- Does **not** account for inventory transfers / pull-outs as off-take (the abandoned Option A).
- Does **not** apply to the **Stockout** replenishment path (Standard path only).
- Does **not** change the `item_sales_daily` rollup grain, refresh job, or backfill.
- Does **not** roll up or correct on-hand counts, and does not touch the selling area's data in ActiveOne.
- Does **not** support a selling area fed by more than one warehouse, nor a location that is both feeder and selling area.

## 4. Users & Roles

- **Admin** — configures the feeder↔selling-area mapping in a new `/admin` tab (`/admin/*` is admin-only via middleware).
- **Staff & Admin** — see the pooled demand reflected on the Standard replenishment screen and generate POs as today. No new permissions on the replenishment side; behavior is identical except the math and the new column.

## 5. Functional Requirements

**Configuration**
- FR-1. An admin can designate any eligible ActiveOne location as a **selling area** and assign it **exactly one** feeder location.
- FR-2. A feeder may have **many** selling areas; a selling area has **exactly one** feeder.
- FR-3. The config UI must prevent: (a) a location being its own feeder; (b) a location being both a feeder and a selling area; (c) selecting a current selling area as a feeder (no chains/cycles).
- FR-4. Mappings are stored in an **app-owned table** (never ActiveOne) and edited selling-area-centrically, displayed grouped by feeder.
- FR-5. Mapping changes are **computed on read** and take effect on the **next** replenishment run — no snapshot, no in-process run mutation.

**Pooled demand (Standard path only)**
- FR-6. For a feeder being replenished, the daily sales rate of each item = feeder's own off-take **plus** the summed off-take of **all** selling areas mapped to it, for the same item.
- FR-7. Off-take for both feeder and selling areas is sourced from `item_sales_daily` (summed base units), summed over the **same From/To range** and divided by the **same full-calendar-span denominator** (never the count of rollup rows).
- FR-8. `effective_available` remains the **feeder's** on-hand + incoming only; the selling area's on-hand never enters the calculation.
- FR-9. `DOS` and the **critical** flag are computed on the **combined** rate.
- FR-10. `suggested_order` uses the combined rate with the existing formula and rounding; only items with `suggested_order > 0` surface, as today.
- FR-11. Items the feeder never sells itself but a mapped selling area does (feeder rate 0, selling-area rate > 0) **surface** in the feeder's run — subject to the existing supplier-scope filter (the item must attribute to one of the run's selected suppliers).
- FR-12. Unit conversion is unchanged: pooled base units are divided by the feeder item's resolved purchase-unit factor (feeder and selling area share the same ActiveOne item, hence the same factor).

**Replenishment UI**
- FR-13. The existing **"Sales rate"** column shows the **combined** rate.
- FR-14. A new **selling-area demand** column appears immediately to the right of "Sales rate", showing the pooled shelf portion in the item's purchase unit (plain mono number), with a tap-friendly tooltip naming the contributing selling area(s).
- FR-15. When no selling area contributes to a row, the new column shows `0` (or empty), and the row is identical to today.

**Location picker guardrail**
- FR-16. In the replenishment location picker only (`module = replenishment`), a configured selling area is shown **disabled/grayed-out** with an explanatory note (e.g. *"Fed by {feeder} — replenished via that warehouse"*) and cannot be selected.
- FR-17. The same location remains normally selectable for all other modules (e.g. delivery).

**Resilience & rollout**
- FR-18. With **no mappings configured**, replenishment behaves exactly as today and the new column is inert (0/hidden).
- FR-19. Reads that pool a selling area's rollup rows must apply the existing **self-heal** (compute-live-then-persist) to missing days for the **selling-area** location, so sparse/un-refreshed days don't undercount pooled demand.
- FR-20. If a mapped feeder or selling area becomes inactive/removed in ActiveOne, the raw mapping is **retained**, that pair is **skipped** in pooling (no error), and the admin tab shows a **warning** on the affected mapping.

## 6. Data Model

**New app-owned table — feeder↔selling-area map** (created via the idempotent `create-app-tables.sql` pattern; not an ActiveOne table):

| Field | Type | Notes |
|---|---|---|
| `selling_area_location_id` | integer, **primary key** | ActiveOne location ID; PK enforces the one-feeder rule |
| `feeder_location_id` | integer | ActiveOne location ID of the warehouse that feeds it |
| `created_at` | datetime | |
| `updated_at` | datetime | |

- Primary key on `selling_area_location_id` guarantees a selling area maps to exactly one feeder.
- Cardinality "one feeder → many selling areas" is the natural many-rows-share-a-`feeder_location_id` shape.
- Validation guards (FR-3) are enforced at the application boundary, not only by the schema: a `feeder_location_id` must not appear as any row's `selling_area_location_id`, and vice versa; `feeder_location_id ≠ selling_area_location_id`.
- No changes to `item_sales_daily`, `supplier_schedule`, or any ActiveOne table.

## 7. API Contract

**Admin — read pooling config**
- `GET /admin/api/order-pooling` (admin-only).
- Response: list of mappings grouped/derivable by feeder; each entry carries selling-area id + display name, feeder id + display name, and a `stale` flag when either location is inactive/removed in ActiveOne.

**Admin — create/update a mapping**
- `POST` (or `PUT`) `/admin/api/order-pooling` (admin-only).
- Request: `{ sellingAreaLocationId, feederLocationId }`.
- Behavior: upsert keyed on `sellingAreaLocationId`. Rejects with a validation error when any FR-3 guard is violated (self-feed, location already a feeder, chosen feeder is itself a selling area).
- Response: minimal confirmation (the saved mapping).

**Admin — remove a mapping**
- `DELETE /admin/api/order-pooling` with `{ sellingAreaLocationId }` (admin-only).
- Response: minimal confirmation.

**Replenishment — Standard data read (modified)**
- Existing Standard replenishment GET is extended: its sales-rate computation pools `item_sales_daily` rows for the feeder **plus** all mapped selling-area location ids over the requested range; self-heal applies to selling-area days (FR-19).
- Response gains a per-item **selling-area demand** value (purchase-unit) and the list of contributing selling-area names for the tooltip. "Sales rate" in the response is the combined rate. `effective_available`, `incoming`, `DOS`, `suggested_order` follow the rules in §5.
- Command-Query separation preserved: this remains a GET; the only writes are the existing self-heal cache population.

**Location picker (modified for replenishment)**
- When serving the location selection for `module = replenishment`, configured selling areas are flagged disabled with the feeder name for the explanatory note (FR-16). Unchanged for other modules.

## 8. UI/UX Flow

**Admin — Order Pooling tab (`/admin`)**
1. Admin opens the new **Order Pooling** tab (admin-only).
2. A searchable **card list** of designated selling areas, **grouped under feeder section headers**; each card shows the selling-area name and its feeder. Stale mappings show a warning marker.
3. Tap **"+ Add selling area"** or an existing card → a **slide-up sheet** opens.
4. The sheet lets the admin choose the location (for new) and pick its **single feeder** from a location picker; guards block invalid choices with an inline message.
5. **Save** upserts and returns to the grouped list; **Remove mapping** deletes it. Changes apply to the next replenishment run.

**Replenishment — Standard path**
1. User runs the Standard path for a **feeder** location (selection chain unchanged).
2. Rows now reflect **combined** demand. **"Sales rate"** = feeder + shelf; the new **selling-area demand** column sits immediately to its right, with a tooltip naming the contributing area(s).
3. **DOS**, **critical**, and **suggested order** are all driven by the combined rate. Shelf-only SKUs appear where they previously didn't.
4. Generate PO → Review → Submit is **unchanged** (still split per supplier + manufacturer; one pooled feeder order).

**Replenishment — location picker**
1. User reaches the location step for replenishment.
2. Any configured selling area is **grayed-out** with a note like *"Fed by Leon Garcia Warehouse — replenished via that warehouse"* and is not selectable.
3. The same location is unaffected in other modules' pickers.

## 9. Edge Cases & Error Handling

- **Selling area already mapped to another feeder** — upsert on the PK replaces the prior feeder (a selling area can only ever have one). UI confirms the change.
- **Attempt to map a location as both feeder and selling area** — rejected by validation (FR-3) with an inline message.
- **Chosen feeder is itself a selling area** (would create a chain) — rejected.
- **Stale/inactive mapped location** — pooling skips the pair, run proceeds, admin tab flags it; no crash (FR-20).
- **Missing rollup days for the selling area** — self-heal computes-live-then-persists them before pooling (FR-19); the full-span denominator (FR-7) keeps the rate correct even when days are sparse.
- **Shelf SKU whose supplier isn't in the run** — does not surface; correct, since it can't be ordered on that PO.
- **Selling area mapped but with zero sales in range** — contributes 0; rows behave as today.
- **No mappings at all** — feature is inert; identical to current behavior (FR-18).
- **Mapping edited mid-run** — in-progress run is unaffected; next run reflects it (FR-5).

## 10. Open Questions

- Final column label wording — "Selling-area demand" vs "Shelf demand" vs another term.
- Whether the tooltip should list every contributing selling area by name, or summarize ("2 selling areas") when there are several.
- Exact admin-tab name in the tab bar ("Order Pooling" used throughout this PRD).

## 11. Out of Scope / Deferred

- **Stockout path** pooling — deferred; its distinct demand model and surfacing gate need their own design.
- **Transfer/pull-out accounting** as off-take (Option A) — rejected in favor of pooling.
- **On-hand rollup / count correction** for the selling area — unchanged; out of scope.
- **Audit log** of mapping changes — deferred (only `created_at`/`updated_at` like other admin config).
- **Multi-feeder selling areas** and **feeder-also-selling-area** topologies — explicitly unsupported.
