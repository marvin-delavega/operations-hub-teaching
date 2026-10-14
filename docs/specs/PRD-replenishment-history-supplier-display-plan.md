# Implementation Plan: Replenishment History Supplier Display & Search

Source PRD: docs/specs/PRD-replenishment-history-supplier-display.md
Date: 2026-08-29

## Summary

Enhance the Replenishment History list to show supplier names inline (comma-separated, truncated) and add a searchable supplier dropdown filter. The work touches the history module's domain types, repository query, API response, and the list page UI. Reuses the existing `/supplier/api` endpoint for dropdown options. No schema changes needed.

## Affected Areas

### Modules / Layers Touched

- **Domain** (`app/(authenticated)/history/domain/ReplenishmentRunSummary.ts`): Add `supplierNames: string[]` to `ReplenishmentRunSummary`
- **Infrastructure** (`app/(authenticated)/history/infrastructure/MySQLReplenishmentHistoryRepository.ts`): Extend `list()` query to aggregate supplier names per run via `GROUP_CONCAT` on `replenishment_run_po.supplier_name`
- **API** (`app/(authenticated)/history/replenishment/api/route.ts`): No changes (already passes `supplierId` filter through)
- **UI** (`app/(authenticated)/history/replenishment/page.tsx`): Add supplier dropdown filter, update card rendering, update CSV export

### Shared Code Reused

- `/supplier/api` endpoint (`app/(authenticated)/supplier/api/route.ts`) — returns supplier list for dropdown options
- `SelectionTile` pattern for dropdown options (adapted for dropdown menu)
- `Input` component for search within dropdown

### DB Tables / Columns

- `replenishment_run_po.supplier_name` — already exists, used for aggregation
- `replenishment_run_po.run_id` — FK to join
- No `create-app-tables.sql` changes required

### container.ts Factories

- No changes — existing `createListReplenishmentHistoryUseCase()` already wired to repository

## Decisions

### Resolved by AI

| Choice | Rationale |
|--------|-----------|
| Aggregate supplier names via `GROUP_CONCAT(DISTINCT supplier_name)` in repository query | Single additional query column; avoids N+1; matches existing pattern of denormalized counts (`supplier_count`) |
| Add `supplierNames: string[]` to `ReplenishmentRunSummary` (not CSV string) | Type-safe; UI can join for display; CSV export can join differently if needed |
| Dropdown filter uses client-side search on fetched supplier list | Reuses `/supplier/api` which returns all suppliers; matches supplier selector pattern; no new API needed |
| Dropdown is a custom component in the page (not a shared primitive) | One-off use; no other history filter needs this pattern yet; YAGNI |
| Truncate supplier names with CSS `line-clamp-2` + `title` attribute for full list | No tooltip dependency; native hover shows full text; minimal code |

### Resolved by Developer

- **Display style**: Comma-separated inline (truncated) — *chosen via question tool*
- **Filter approach**: Searchable dropdown — *chosen via question tool*

### Assumptions

- `/supplier/api` returns all suppliers (not paginated) — current implementation returns full array
- Supplier list is small enough for client-side filtering (< 500 typical)
- Existing `supplierId` filter in repository correctly filters runs that *include* the supplier (via EXISTS subquery) — already implemented
- CSV export format: add "Suppliers" column after "Created By" (before "POs")

## Implementation Steps

### 1. Domain: Extend `ReplenishmentRunSummary`

**File**: `app/(authenticated)/history/domain/ReplenishmentRunSummary.ts`

Add `supplierNames: string[]` to the `ReplenishmentRunSummary` interface.

```typescript
export interface ReplenishmentRunSummary {
  // ...existing fields
  supplierCount: number;
  supplierNames: string[];  // NEW
  poCount: number;
  // ...
}
```

### 2. Infrastructure: Update Repository Query

**File**: `app/(authenticated)/history/infrastructure/MySQLReplenishmentHistoryRepository.ts`

In the `list()` method:
- Modify the main SELECT to include a subquery or LEFT JOIN with GROUP_CONCAT for supplier names
- Map the result to the new `supplierNames` field (split CSV string to array)

SQL approach (subquery in SELECT clause):
```sql
SELECT r.*,
  (SELECT GROUP_CONCAT(DISTINCT supplier_name ORDER BY supplier_name SEPARATOR ', ')
   FROM replenishment_run_po rp WHERE rp.run_id = r.id) AS supplier_names_csv,
  -- existing columns...
```

Then in mapping:
```typescript
supplierNames: r.supplier_names_csv ? r.supplier_names_csv.split(', ') : [],
```

Also update `RunSummaryRow` interface to include `supplier_names_csv: string | null`.

### 3. UI: Create Supplier Dropdown Component

**File**: `app/(authenticated)/history/replenishment/page.tsx` (inline component or extract if reused)

Add a new component `SupplierDropdown` inside the page file:
- State: `suppliers`, `search`, `open`, `selectedId`
- Fetch suppliers from `/supplier/api` on mount (once)
- Render: trigger button showing selected name or "All Suppliers", dropdown panel with search input + filtered options
- On select: update `selectedId`, call `onChange(selectedId)`, close dropdown
- Keyboard: ArrowDown/Up to navigate, Enter to select, Escape to close
- Click outside to close (use `useEffect` with ref)

Style: Match shadcn `Select` visual but with search — use `DropdownMenu` primitives if available, or custom with `bg-popover`, `border-border`, `shadow-md`.

### 4. UI: Update Filter Bar

**File**: `app/(authenticated)/history/replenishment/page.tsx`

- Add `supplierId` state (number | null)
- Add `suppliers` state for dropdown options
- Insert `SupplierDropdown` between date inputs and Clear button
- Pass `selectedId` and `onChange` to update `supplierId` and trigger reload
- Update `buildParams` to include `supplierId` when set (already handled by API)

### 5. UI: Update Run Card Rendering

**File**: `app/(authenticated)/history/replenishment/page.tsx`

Replace the supplier count display:
```tsx
// Before:
<p className="type-caption text-muted-foreground">
  {run.supplierCount} {run.supplierCount === 1 ? "supplier" : "suppliers"}
</p>

// After:
<p className="type-caption text-muted-foreground line-clamp-2" title={run.supplierNames.join(", ")}>
  {run.supplierNames.length > 0 ? run.supplierNames.join(", ") : "—"}
</p>
```

### 6. UI: Update CSV Export

**File**: `app/(authenticated)/history/replenishment/page.tsx`

In `exportListCsv`:
- Add "Suppliers" to header (after "Created By")
- Map `run.supplierNames.join(", ")` in row data

### 7. Verify & Lint

Run:
```bash
npm run lint
npx tsc --noEmit
```

## Risks & Open Questions

1. **GROUP_CONCAT length limit**: MySQL's `group_concat_max_len` defaults to 1024. If a run has many suppliers with long names, truncation may occur. Mitigation: `SET SESSION group_concat_max_len = 8192` in the query, or handle in application layer.

2. **Supplier dropdown performance**: If supplier list grows large (>1000), client-side filtering may lag. Current assumption is <500. Monitor and add server-side search if needed.

3. **Type mapping**: Ensure `supplier_names_csv` can be null (no POs) — handle in mapping with fallback to empty array.

4. **Existing `supplier_count` denormalized column**: Keep it (used for other purposes?); new `supplierNames` is additional.

5. **Dropdown accessibility**: Ensure ARIA attributes (`aria-expanded`, `aria-controls`, `role="listbox"`, `role="option"`) for screen readers.