# PRD: Supplier Selection Module
Date: 2026-06-20

## 1. Overview
The supplier selection module is a reusable navigation hub that allows users to pick one or more suppliers before entering a module that requires supplier context. It follows the same structural pattern as the location selection module (`/location`) — a standalone route that collects a selection and redirects forward with the result appended as a query param. It is independent of location selection and can appear in any position in a module's entry flow.

## 2. Goals
- Provide a reusable, consistent supplier selection step any module can slot into its entry flow.
- Allow users to quickly find and select multiple suppliers via search and checkboxes.
- Pass selected supplier IDs downstream without losing other accumulated query params.
- Pre-populate selections when the user navigates back from a module.

## 3. Non-Goals
- Per-module supplier visibility filtering (all suppliers are always shown).
- Single-select mode (always multi-select).
- Admin management of supplier visibility.
- Smart ordering by supplier schedule (deferred).
- Displaying anything beyond supplier name per row.

## 4. Users & Roles
All authenticated users (staff and admin) can access `/supplier`. No role restriction.

## 5. Functional Requirements
- **FR-1** The route `/supplier` accepts the following query params:
  - `returnTo` (required) — the URL (path + existing query string, URL-encoded) to redirect to after selection.
  - `supplierIds` (optional) — comma-separated supplier IDs to pre-select on load.
- **FR-2** On load, the page fetches all suppliers and renders them as a searchable, checkbox list. None are selected by default unless `supplierIds` is present.
- **FR-3** The search input filters the visible list by supplier name (case-insensitive, partial match). Non-matching suppliers are hidden but remain selected if previously checked.
- **FR-4** When the search query matches no suppliers, a "No suppliers found" message is shown in place of the list.
- **FR-5** Each list row shows the supplier name and a checkbox. Tapping anywhere on the row toggles the checkbox.
- **FR-6** A "Continue (N selected)" button is displayed at the bottom. It is disabled when N = 0 and enabled when N ≥ 1.
- **FR-7** Tapping Continue redirects to `{returnTo}&supplierIds={comma-separated IDs of selected suppliers}`.
- **FR-8** While suppliers are loading, a skeleton list is shown in place of the supplier rows.
- **FR-9** If the supplier fetch fails, a clear error message is shown with a retry option.
- **FR-10** The page title follows the convention: `{Company Name} · Ops Hub · Select Suppliers`.
- **FR-11** The page heading reads "Select Suppliers".

## 6. Data Model
**Supplier** (read-only, sourced from ActiveOne ERP):
| Field | Type   | Description                    |
|-------|--------|--------------------------------|
| id    | number | Unique supplier identifier     |
| name  | string | Display name of the supplier   |

Source: `Contact` table, `type = 3`. Mocked for initial implementation.

No owned tables. No writes.

## 7. API Contract
**GET `/supplier/api`**
- Request: no params.
- Response (200):
  ```
  { suppliers: Array<{ id: number, name: string }> }
  ```
  Sorted alphabetically by name (smart ordering deferred).
- Response (500): `{ error: string }`

## 8. UI/UX Flow
1. User arrives at `/supplier?returnTo=%2Fsales-rate%3FlocationId%3D1` (with optional `&supplierIds=2,3,5`).
2. Page shows heading "Select Suppliers", a search input, and a skeleton list while fetching.
3. Fetch completes — skeleton replaced by supplier rows, each with a checkbox.
   - If `supplierIds` param is present, those suppliers are pre-checked.
4. User types in the search box — list filters live to matching supplier names.
   - If no results: "No suppliers found" message replaces the list.
5. User taps supplier rows to toggle checkboxes.
6. Continue button updates in real time: "Continue (N selected)". Disabled at N = 0.
7. User taps Continue → redirected to `/sales-rate?locationId=1&supplierIds=2,3,5`.
8. If user navigates back (via a "Change Suppliers" link from the module), the module passes the current `supplierIds` back to `/supplier?returnTo=...&supplierIds=2,3,5` — selections are pre-populated.

**Chaining with location (example):**
`/location` → selects location → redirects to `/supplier?returnTo=%2Fsales-rate%3FlocationId%3D1` → selects suppliers → redirects to `/sales-rate?locationId=1&supplierIds=2,3,5`.

## 9. Edge Cases & Error Handling
| Scenario | Response |
|---|---|
| `returnTo` param missing | Show error: "Invalid navigation — missing destination." |
| Supplier fetch fails | Show error message with a Retry button that re-fetches. |
| No suppliers returned (empty DB) | Show "No suppliers available." in place of the list. |
| Search matches nothing | Show "No suppliers found." — list is empty, previously selected items remain checked. |
| User clears search after filtering | Full list restored; selected state preserved. |
| Continue tapped with 0 selected | Not possible — button is disabled. |

## 10. Open Questions
- None. All decisions made.

## 11. Out of Scope / Deferred
- **Smart ordering** — suppliers ordered by schedule frequency/recency. Deferred; alphabetical for now.
- **Per-module supplier visibility** — admin-managed suppression of suppliers per module. Explicitly out of scope.
- **Select All / Clear All shortcut** — not needed given typical selection size (~10 of 300).
