# Replenishment History Supplier Display & Search -- Feature Ideas

Captured 2026-08-29. Not yet scoped -- each Tier 1 item likely warrants its own PRD before implementation.

Context: The replenishment history list currently shows only a supplier count (e.g., "3 suppliers") but not the actual supplier names. Users want to see supplier names in the list view and be able to filter/search by supplier. The supplier selector module (`/supplier`) already exists with search functionality and a `/supplier/api` endpoint that returns supplier data.

## Tier 1 -- Highest value
- [ ] **Show supplier names in history list** -- Each run card should display the supplier names (truncated if many) instead of just a count, matching the detail view which already shows supplier names per PO.
- [ ] **Add supplier filter to history list** -- Add a dropdown/select to filter runs by supplier, reusing the existing `supplierId` filter parameter already supported by the API and repository.

## Tier 2 -- Strong, moderate effort
- [ ] **Link to supplier selector for picking filter** -- Add a "Select supplier" button that opens the `/supplier` selection module (with `returnTo` pointing back to history), allowing users to pick from the full supplier list with search and due-date sections.
- [ ] **Show supplier names in CSV export** -- Include supplier names in the exported CSV alongside the existing columns.

## Tier 3 -- Convenience / workflow
- [ ] **Multi-supplier filter** -- Allow filtering by multiple suppliers at once (comma-separated IDs), matching the supplier selector's multi-select capability.
- [ ] **Supplier column in list** -- Add a dedicated "Suppliers" column in a table-style layout instead of inline text, for better scanning when there are many runs.

## Suggested starting point
Start with **Tier 1**: Update the repository to fetch supplier names (aggregated per run), add them to `ReplenishmentRunSummary`, and display them in the list card. Then add a simple supplier dropdown filter using the existing `/supplier/api` endpoint for options. This delivers immediate value with minimal changes and reuses existing patterns.