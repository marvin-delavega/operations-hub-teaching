# PRD: Shelf Allocation Guide
Date: 2026-08-21

## 1. Overview

A read-only **Shelf Allocation Guide** — a new floor tool that shows floor staff *how fast each supplier's items sell*, so they allocate shelf space proportionally to demand. It is a **sales-velocity / share guide**, not a physical planogram: "allocation" is expressed as each item's (and supplier's) **share of total sold quantity**, not facings or shelf centimeters. It analyzes a **single location's** sales (typically a storefront / selling area) from the existing `item_sales_daily` rollup, using a **recency-weighted daily rate** that favors upward momentum. Two screens: a **supplier overview** (ranked by share) and a **supplier detail** (item-by-item velocity table with a dashboard header). Read-only throughout — no PO writes, no history, no write-backs to ActiveOne.

## 2. Goals

- Rank suppliers by their share of total sold quantity in a chosen period, with a bar visualization and a top-item sneak peek.
- Within a supplier, list every sold item ordered by a **recency-weighted daily rate** (pcs/day), with allocation %, total sold, and a progress bar.
- Show a dashboard header per supplier: supplier name, supplier allocation %, top-selling item, and a velocity-tier distribution.
- Default the analysis location to an admin-configured **default selling-area location**, while remaining filterable to **any active location** on both screens.
- Reuse the existing `item_sales_daily` rollup and its self-heal — no schema change.

## 3. Non-Goals

- **No physical shelf math** — no facings, shelf width, or planogram dimensions.
- **No pooling** across locations — the guide analyzes exactly one selected location (not a feeder + selling-area aggregate like Standard replenishment).
- **No write-backs** to ActiveOne, no POs, no history records, no persistence of any run.
- **No purchase-unit conversion** — all quantities display in **base units (pcs)**.
- **No stockout path** — not tied to replenishment's Standard/Stockout fork.
- **No chart library** — bars are token-styled divs (consistent with the existing progress-bar pattern).
- **No CSV export** in v1.

## 4. Users & Roles

- Any authenticated user holding **`module.shelfguide`** (a new module permission). The seeded **Administrator** role gets it automatically (its permissions resolve to the full catalog). Intended audience is floor staff, but it is a normal grantable module permission.
- Admin configures the **default selling-area location** via a new **Shelf Guide** admin tab gated by **`admin.shelfguide_settings`**.

## 5. Functional Requirements

**Location & date scoping**
- FR-1. The guide analyzes a **single location**. The location is a **dropdown of all active ActiveOne locations** (`location.INACTIVE = 0`), not a navigation selection chain.
- FR-2. The dropdown defaults to the admin-configured default location (`shelfguide_default_location_id`); if unset, it defaults to the **first active location alphabetically**. If no active locations exist, an empty state is shown.
- FR-3. A **date-range filter** (From → To) sits at the top of both views; default **From = today − 30 days, To = today** (Asia/Manila). Changing the location or range re-fetches.
- FR-4. Sales are read from `item_sales_daily` for the selected location + range; the existing **self-heal** (`ensureDaysExist`) runs first so sparse/un-refreshed days are backfilled before reading.

**Supplier overview (screen 1)**
- FR-5. Shows every supplier that has **≥ 1 sold unit** in the selected location + range (suppliers derived from the sold items — no separate supplier query).
- FR-6. Each supplier card shows: supplier **name**, **item count** (distinct sold items), **share %** = supplier total sold ÷ grand total sold, a **bar** whose length visualizes that share, and a **top-item sneak peek** (code + description of the item with the highest total sold).
- FR-7. Suppliers are sorted by **total sold descending**.
- FR-8. A **search bar** filters suppliers client-side (case-insensitive, partial, on name).

**Supplier detail (screen 2)**
- FR-9. Tapping a supplier drills into its items (client-side navigation via `?supplierId=`; the detail shares the same location + date controls).
- FR-10. The item table lists, per sold item: **code**, **description**, **daily rate** (recency-weighted, pcs/day), **progress bar + allocation %**, and **total sold** (pcs).
- FR-11. Items are ordered by **weighted daily rate descending**.
- FR-12. **Allocation %** = item total sold ÷ supplier total sold; the progress bar's width visualizes it.
- FR-13. Each item carries an **ABC velocity tier** badge (see §6) and its **rank** within the supplier (by daily rate).
- FR-14. A **search bar** filters items client-side (case-insensitive, partial, on code or description).

**Detail dashboard header (screen 3)**
- FR-15. Above the table: the **supplier name** in the header, the supplier's **allocation %** (share of grand total), the **top-selling item**, and a **velocity-tier distribution** bar showing the count of items in each of A / B / C (replaces the originally proposed pie for readability; see §10).

**Daily-rate method**
- FR-16. The **daily rate is a recency-weighted average** favoring recent/upward movement, using a **half-life decay** (see §6). It is NOT replenishment's simple `units ÷ days` average.

**Admin setting**
- FR-17. The default location is stored in `app_settings` key `shelfguide_default_location_id` (stringified ActiveOne location ID), edited from a new **Shelf Guide** admin tab (single location dropdown). Blank/absent = no default (falls back to FR-2).

## 6. Data Model

**No new tables or columns.** Everything reads from `item_sales_daily`, ActiveOne `item`/`contact`/`location`, and the existing `app_settings` key-value store.

- `app_settings` gains one key: **`shelfguide_default_location_id`** (created lazily on first save via the existing upsert pattern).

**Recency-weighted daily rate (domain formula):**

Given the selected range `[from, to]` (inclusive) and a constant `HALF_LIFE_DAYS = 14`:

- `age(d) = DATEDIFF(to, d)` — days back from the range end.
- `weight(d) = 0.5 ^ (age(d) / HALF_LIFE_DAYS)`.
- `weightedDailyRate(item) = Σ_d (units_d × weight(d)) / Σ_{all calendar days in [from,to]} weight(d)`.

The denominator is a **constant over all calendar days** in the range (zero-sale days still count in the denominator), so the result is a proper pcs/day figure biased toward recent days. `totalSold(item) = Σ_d units_d` (plain sum).

**ABC velocity tier (domain formula):** rank a supplier's items by `totalSold` descending, then compute cumulative share of the supplier's total; **A** = cumulative share ≤ 50%, **B** = ≤ 80%, **C** = remainder. Thresholds are code constants.

## 7. API Contract

**Overview — `GET /shelfguide/api`** (requires `module.shelfguide` via middleware)

- Query: `from` (YYYY-MM-DD), `to` (YYYY-MM-DD), `locationId` (optional — server resolves the default when absent).
- Self-heals the selected location's range, then returns:
  ```json
  {
    "locationId": 12,
    "defaultLocationId": 12,
    "grandTotalSold": 12450,
    "suppliers": [
      {
        "supplierId": 3,
        "name": "Acme Foods",
        "itemCount": 42,
        "totalSold": 5200,
        "sharePercent": 41.8,
        "topItem": { "code": "SKU-001", "description": "Canned Corn 12oz" }
      }
    ]
  }
  ```
- Suppliers sorted by `totalSold` desc; `sharePercent` = `totalSold / grandTotalSold × 100` (1 decimal).

**Detail — `GET /shelfguide/api/[supplierId]`** (requires `module.shelfguide`)

- Query: `from`, `to`, `locationId` (same resolution).
- Returns:
  ```json
  {
    "supplierId": 3,
    "name": "Acme Foods",
    "sharePercent": 41.8,
    "grandTotalSold": 12450,
    "topItem": { "code": "SKU-001", "description": "Canned Corn 12oz", "totalSold": 800 },
    "items": [
      {
        "code": "SKU-001",
        "description": "Canned Corn 12oz",
        "dailyRate": 18.4,
        "totalSold": 800,
        "allocationPercent": 15.4,
        "abcTier": "A",
        "rank": 1
      }
    ]
  }
  ```
- Items sorted by `dailyRate` desc; `allocationPercent` = `totalSold / supplier total × 100` (1 decimal).

**Locations — reused** `GET /location/api?module=shelfguide&showAll=true` (session-only, existing shared endpoint) powers the location dropdown on both the guide screen and the admin tab.

**Admin — settings (extended)** `GET` / `PUT /admin/api/settings` gains `shelfguide_default_location_id`, read/written under the `admin.shelfguide_settings` permission (existing per-key pattern).

Command-Query separation preserved: both guide endpoints are pure GETs (self-heal cache population is the only write, as in replenishment).

## 8. UI/UX Flow

**Shelf Guide — supplier overview (`/shelfguide`)**
1. User opens the module from the home card.
2. Top controls: **location dropdown** (default = configured selling area), **From/To date range** (default last 30 days), **search bar**.
3. Body: a ranked list of **supplier cards** — name, item count, share %, share bar, and the top-item sneak peek. Tap a card → detail.

**Shelf Guide — supplier detail (`/shelfguide?supplierId=3`)**
1. Same top controls (location, date range, search) remain.
2. **Dashboard header**: supplier name · supplier allocation % · top-selling item · A/B/C velocity distribution bar.
3. **Item table**: code · description · daily rate (pcs/day) · progress bar + allocation % · total sold · ABC badge · rank — sorted by daily rate desc.
4. Back returns to the overview.

**Admin — Shelf Guide tab**
1. Admin opens **Admin → Shelf Guide**.
2. A single **location dropdown** (default location) with **Save**. Changes take effect on the next guide load.

## 9. Edge Cases & Error Handling

| Case | Behavior |
|---|---|
| No active locations | Empty state message on the guide. |
| No default location configured | Fall back to first active location alphabetically. |
| Selected location has no sales in range | Supplier list shows the empty state ("No sales in this period"). |
| Supplier with a single item | allocation % = 100%; ABC tier A; bar full width. |
| Zero-sale item in range | Excluded entirely (guide is "what's selling"). |
| `supplierId` not found / no sales | Detail shows empty state; share/items omitted. |
| Date range where `from > to` | Rejected at the API boundary (400). |
| Missing rollup days | Self-healed via `ensureDaysExist` before reading. |
| Long range / large supplier | Accepted for v1; client-side rendering, no pagination. |

## 10. Open Questions

- **Pie vs bars** — the original ask was a pie for "items per daily rate"; the PRD replaces it with a **velocity-tier (A/B/C) bar distribution** for readability. Confirm.
- **Half-life value** (14 days) — code constant; adjustable later if needed.
- **ABC thresholds** (50/80) — code constants.
- Whether the seeded **Staff** role should include `module.shelfguide` by default (see plan).

## 11. Out of Scope / Deferred

- Physical facings / shelf-width planogram (requires per-item facings config that ActiveOne does not have).
- Real pie/line chart library (recharts) — only if bars prove insufficient.
- Printable shelf plan; CSV export.
- Persistence / history / audit of guide views.
- Per-location visibility config for the guide (the dropdown always shows all active locations).
- Configurable half-life / ABC thresholds in the admin UI.
