# PRD: Replenishment Manufacturer Sub-Grouping
Date: 2026-06-29

## 1. Overview
Replenishment items are currently grouped by supplier only. This feature adds a manufacturer sub-grouping layer within each supplier section, allowing the procurement officer to select or deselect items by manufacturer and generate one purchase order per supplier + manufacturer combination. The feature applies to both the Standard and Stockout replenishment paths.

## 2. Goals
- Procurement officers can include or exclude specific manufacturers from a replenishment run without touching individual items.
- Generated POs are split per supplier + manufacturer combination, not just per supplier.
- Manufacturer identity is stamped on each generated PO for traceability in ActiveOne.
- UI structure is consistent across the replenishment screen, review screen, and success summary.

## 3. Non-Goals
- Does not add manufacturer filtering or browsing outside of the replenishment flow.
- Does not change the item-level quantity override on the review screen — overrides remain per item only, no manufacturer-level bulk override.
- Does not modify how ActiveOne's `manufacturer` table is managed (read-only from this app).
- Does not distinguish "stockout POs" from "standard POs" — no special tag on the generated PO.

## 4. Users & Roles
- **Staff and Admin**: can use the replenishment screen, select/deselect manufacturers, and generate POs.
- **Admin only**: no additional manufacturer-specific permissions beyond what currently exists.

## 5. Functional Requirements

### Data
- **FR-1**: Each replenishment item query must JOIN `item` to `manufacturer` on `item.MANUFACTURER_ID = manufacturer.ID` and return `manufacturer.ID` and `manufacturer.NAME`. Items where `MANUFACTURER_ID` is null or has no matching manufacturer row are treated as "No Brand."

### Grouping Structure
- **FR-2**: Within each supplier section, items are further sub-grouped by manufacturer. Each distinct `manufacturer.ID` (plus the "No Brand" bucket) forms one manufacturer sub-group.
- **FR-3**: Manufacturer sub-groups within a supplier are sorted alphabetically by manufacturer name. The "No Brand" sub-group is always pinned first, before all named manufacturers.
- **FR-4**: Items within each manufacturer sub-group are sorted by DOS ascending (Standard path) or by last-sold date descending (Stockout path), matching existing per-path item sort rules.

### Manufacturer Sub-Group Header (Standard Path)
- **FR-5**: Each manufacturer sub-group header displays: checkbox · manufacturer name · item count · critical badge · order period selector (7 / 14 / 30).
- **FR-6**: The critical badge on the manufacturer sub-group header shows the count of items in that sub-group where DOS < supplier lead time. It is hidden when the count is zero.
- **FR-7**: The order period selector on the manufacturer sub-group header controls the order period for all items in that sub-group only. Changing it immediately re-filters and re-calculates items in that sub-group.
- **FR-8**: The supplier group header retains its critical badge showing the aggregate count of critical items across all manufacturer sub-groups within it. It is hidden when zero.
- **FR-9**: The supplier group header no longer shows an order period selector — it has been moved to the manufacturer sub-group level.

### Manufacturer Sub-Group Header (Stockout Path)
- **FR-10**: Each manufacturer sub-group header on the Stockout path displays: checkbox · manufacturer name · item count · order period selector (7 / 14 / 30). No critical badge, no "Due" tag — mirroring the Stockout supplier header rules.

### Checkboxes & Selection
- **FR-11**: Each manufacturer sub-group header has a checkbox that selects or deselects all items within that sub-group.
- **FR-12**: The supplier group checkbox follows tri-state behavior: checked when all manufacturer sub-groups are fully selected, unchecked when all are fully deselected, indeterminate when partially selected.
- **FR-13**: Individual item checkboxes are unchanged.
- **FR-14**: Standard path: all item checkboxes default checked. Stockout path: all item checkboxes default unchecked. This applies at the manufacturer sub-group and individual item levels.

### Collapse / Expand
- **FR-15**: Manufacturer sub-groups are independently collapsible. Collapse state is tracked per sub-group and is not reset when the parent supplier section is toggled.
- **FR-16**: The global Expand/Collapse All control expands or collapses both supplier sections and all manufacturer sub-groups simultaneously.

### PO Generation & Split
- **FR-17**: On submission, selected items are split into one PO per unique supplier + manufacturer combination. Items in the "No Brand" sub-group that are selected form one PO per supplier (with no manufacturer identity — they are not merged with any named-manufacturer PO).
- **FR-18**: Submission remains atomic — any single PO write failure rolls back all POs in the batch.
- **FR-19**: `purchase_order.CUSTOM_FIELD3` is written with the manufacturer name (e.g., `"Nestlé"`) for named-manufacturer POs. For "No Brand" POs, `CUSTOM_FIELD3` is written as `NULL`. All other replenishment-generated PO fields are unchanged.

### Review Screen
- **FR-20**: The review screen (Generate PO → Review → Submit) mirrors the two-level supplier → manufacturer sub-group structure.
- **FR-21**: Manufacturer sub-group headers on the review screen show: manufacturer name · item count. No checkboxes, no order period selector (quantities are already locked).
- **FR-22**: Per-item quantity overrides on the review screen remain unchanged — item-level only.

### Success Summary
- **FR-23**: The success summary screen is structured as supplier sections, each containing one row per submitted PO. Each row shows: manufacturer name (or "No Brand") · PO number · distinct item count.

## 6. Data Model

### Read (existing, extended)
- `item.MANUFACTURER_ID` (int, nullable) — FK to `manufacturer.ID`.
- `manufacturer` table: `ID` (int PK), `CODE` (varchar 10), `NAME` (varchar 50).
- Query must LEFT JOIN `manufacturer` on `item.MANUFACTURER_ID` so items with no manufacturer are included.

### Write (extended)
- `purchase_order.CUSTOM_FIELD3` — manufacturer name string for named-manufacturer POs; NULL for "No Brand" POs. No schema change required.

### No schema changes
- All new grouping is computed at the application layer from existing `item.MANUFACTURER_ID` and the `manufacturer` table.

## 7. API Contract

### Replenishment data endpoint (existing, extended)
- **Method/Path:** existing replenishment GET endpoint
- **Response change:** each item in the response gains two new fields:
  - `manufacturerId: number | null`
  - `manufacturerName: string | null` (null = "No Brand" in the UI)

### PO submission endpoint (existing, extended)
- **Method/Path:** existing replenishment POST/submit endpoint
- **Request change:** each submitted item already carries enough identity. Server re-derives the supplier + manufacturer split from item data. No new request fields needed.
- **Response change:** success payload gains `manufacturerName: string | null` per PO row in the summary.

## 8. UI/UX Flow

### Standard Path — Replenishment Screen
1. Supplier sections render as today (collapsible, tri-state checkbox, aggregate critical badge, "Due" tag, total item count).
2. Inside each supplier section, manufacturer sub-groups appear as collapsible sub-rows: "No Brand" first, then named manufacturers alphabetically.
3. Each manufacturer sub-group header: checkbox · name · item count · critical badge (if any) · order period selector.
4. Items render inside their manufacturer sub-group, sorted by DOS ascending.
5. Changing the order period selector on a manufacturer sub-group immediately re-filters and re-calculates that sub-group's items.
6. Tapping "Generate PO" proceeds to the Review screen.

### Stockout Path — Replenishment Screen
1. Same two-level structure. Manufacturer sub-group header: checkbox · name · item count · order period selector (no critical badge).
2. Items sorted by last-sold date descending within each sub-group.
3. All checkboxes default unchecked.

### Review Screen (both paths)
1. Two-level display: supplier section → manufacturer sub-group → items.
2. Manufacturer sub-group header shows name and item count only.
3. Per-item quantity overrides available as before.
4. "Submit PO" triggers atomic multi-PO write.

### Success Summary (both paths)
1. One supplier section per vendor.
2. Each section lists the POs generated, one row per manufacturer sub-group: manufacturer name (or "No Brand") · PO number · item count.

## 9. Edge Cases & Error Handling

| Scenario | Expected Behavior |
|---|---|
| Item has `MANUFACTURER_ID` that is null | Item falls into "No Brand" sub-group |
| Item has `MANUFACTURER_ID` with no matching `manufacturer` row (FK constraint violation — should not happen) | Treated as "No Brand" as a safe fallback |
| All items in a manufacturer sub-group are unchecked | That sub-group generates no PO; omitted from success summary |
| All manufacturer sub-groups within a supplier are unchecked | That supplier generates no PO; supplier section omitted from success summary |
| Supplier section has only one manufacturer | Single manufacturer sub-group renders inside it; no supplier-level order period selector shown |
| Atomic submission fails on one PO | All POs in the batch are rolled back; error displayed; user can retry |
| "No Brand" sub-group spans multiple suppliers | Each supplier gets its own "No Brand" PO independently; `CUSTOM_FIELD3` = NULL on each |

## 10. Open Questions
None — all key decisions resolved in brainstorm.

## 11. Out of Scope / Deferred
- Manufacturer-level bulk quantity override on the review screen.
- Filtering or browsing replenishment data by manufacturer outside this grouping UI.
- Any write-back to `manufacturer` or `item.MANUFACTURER_ID` from this app.
- Distinguishing stockout-origin POs from standard POs in any field.
- Reading `CUSTOM_FIELD3` back in a PO history or audit view (deferred to a future PO list/edit module).
