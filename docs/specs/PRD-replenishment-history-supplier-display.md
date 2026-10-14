# PRD: Replenishment History Supplier Display & Search

Date: 2026-08-29

## 1. Overview

Enhance the Replenishment History list view to show actual supplier names (not just a count) and provide a searchable dropdown filter for supplier selection. The current implementation displays only `supplierCount` (e.g., "3 suppliers") but the detail view already shows supplier names per PO. The supplier selector module and API already exist and can be reused.

## 2. Goals

- Show supplier names inline in each run card (comma-separated, truncated if many)
- Add a searchable supplier dropdown filter to the filter bar
- Reuse the existing `/supplier/api` endpoint for filter options
- Maintain all existing filter behavior (AND-combined with other filters)

## 3. Non-Goals

- No multi-select in the dropdown (single supplier filter per the existing `supplierId` parameter)
- No link to the full `/supplier` selector module (simple dropdown only)
- No changes to Delivery History
- No schema changes (supplier names already stored in `replenishment_run_po.supplier_name`)

## 4. Functional Requirements

### List View Display

- **FR-1**: Each run card shows supplier names as comma-separated text (e.g., "Acme Corp, Beta Supplies, Gamma Goods")
- **FR-2**: If the combined string exceeds ~2 lines, truncate with "…" (CSS `line-clamp-2` or similar)
- **FR-3**: Hover/tooltip shows the full list (native `title` attribute or tooltip component)

### Filter Bar

- **FR-4**: Add a searchable dropdown labeled "Supplier" in the filter bar (between location and created-by filters)
- **FR-5**: Dropdown options populated from `GET /supplier/api` (returns `{id, name, nextOrderDate, dueStatus}`)
- **FR-6**: Search filters options client-side as user types (like the supplier selector module)
- **FR-7**: Selecting a supplier adds `supplierId` to the query params; clearing removes it
- **FR-8**: Filter combines with existing filters via AND (already implemented in repository)

### CSV Export

- **FR-9**: Include supplier names in the exported CSV (new column "Suppliers")

## 5. Data Model

No schema changes. The `replenishment_run_po` table already stores `supplier_name` per PO. The repository query needs to aggregate supplier names per run.

## 6. API Contract

### `GET /history/replenishment/api`

- **Input**: Unchanged (already supports `supplierId`)
- **Response items**: Add `supplierNames: string[]` (or `supplierNamesCsv: string`) to `ReplenishmentRunSummary`

### `GET /supplier/api`

- Already exists, returns `{ suppliers: { id, name, nextOrderDate, dueStatus }[] }`

## 7. UI/UX

### Filter Bar Layout (left to right)

1. Search PO code (existing)
2. Date From / To (existing)
3. **Supplier dropdown [NEW]**
4. Clear button (existing, when any filter active)
5. Drafts/All segmented toggle (existing)
6. Export CSV (existing)

### Dropdown Behavior

- Opens on click, shows search input + filtered options
- Options show supplier name; due status shown as badge (Due Today / Due Tomorrow / Other)
- Click option → selects, closes dropdown, triggers reload
- "Clear" option at top when a supplier is selected
- Keyboard navigable (ArrowDown/Up, Enter, Escape)

## 8. Implementation Notes

### Repository Query

Extend the `list` query in `MySQLReplenishmentHistoryRepository` to aggregate supplier names per run. Use `GROUP_CONCAT` or a subquery to collect distinct `supplier_name` from `replenishment_run_po` joined on `run_id`.

### Type Changes

- `ReplenishmentRunSummary` interface: add `supplierNames: string[]`
- `HistoryFilters` already has `supplierId` — no change needed

### Components

- New shared dropdown component or reuse pattern from supplier selector
- Update `app/(authenticated)/history/replenishment/page.tsx` filter bar and card rendering
- Update CSV export to include supplier names

## 9. Acceptance Criteria

1. Run cards show supplier names instead of just count
2. Supplier dropdown appears in filter bar
3. Dropdown searches suppliers from `/supplier/api`
4. Selecting a supplier filters the list correctly
5. CSV export includes supplier names column
6. All existing filters (search, date, location, created-by, drafts) still work in combination
7. No regression in pagination/infinite-scroll