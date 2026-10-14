# PRD: Per-Location PO Generation
Date: 2026-06-17

## 1. Overview
PO generation in the sales-rate module is scoped to a physical or logical location (warehouse, selling area, etc.) drawn from ActiveOne ERP. A new shared `app/location/` module provides a location selection screen that any future module can reuse. The selected location scopes all inventory reads, sales data queries, and PO writes for that session.

## 2. Goals
- Scope all sales-rate replenishment data (inventory, sales, POs) to a single selected location
- Tag generated POs with the selected location ID in ActiveOne
- Provide a shared, reusable location selection screen usable by future modules
- Allow admins to curate which locations appear per module (hide/show)
- Support direct deep-link navigation to a location-scoped screen

## 3. Non-Goals
- Does not add per-location lead times (deferred)
- Does not support multi-location PO generation in a single session
- Does not persist the last selected location across sessions
- Does not add replenishment item counts to location cards (premature optimization)
- Does not create a dedicated `/admin/locations` sub-route (managed on `/admin` for now)

## 4. Users & Roles
- **Staff**: selects a location from the curated list, proceeds into the scoped replenishment flow; can reveal hidden locations via "Show all" toggle but cannot change visibility
- **Admin**: manages per-module location visibility from the `/admin` page

## 5. Functional Requirements

FR-1. A new `app/location/` module exposes a route at `/location` that renders a location selection screen.

FR-2. The location screen accepts two URL query params: `module` (identifies the calling module, e.g. `sales-rate`) and `returnTo` (the URL to redirect to after selection).

FR-3. The location screen fetches locations from ActiveOne filtered to those not hidden for the given `module`, and displays them as named cards.

FR-4. Selecting a location card redirects the user to `{returnTo}?locationId={id}`.

FR-5. A "Show all locations" toggle on the location screen reveals locations hidden for that module. Hidden locations are visually distinguished (e.g. muted styling) but remain selectable.

FR-6. The `sales-rate` module entry point (`/sales-rate`) redirects to `/location?module=sales-rate&returnTo=/sales-rate` when no `locationId` query param is present.

FR-7. When `locationId` is present in the URL, the sales-rate screen renders directly without passing through location selection.

FR-8. If the `locationId` does not exist in ActiveOne, the sales-rate screen displays an error state rather than loading data.

FR-9. All sales-rate queries — inventory (on-hand), incoming PO quantities, and sales data — are filtered to the selected `locationId`.

FR-10. Generated POs are written to ActiveOne tagged with the selected `locationId`.

FR-11. Location visibility is stored on our side as a per-module, per-location hidden flag.

FR-12. Admins can toggle location visibility per module from the `/admin` page. Changes take effect immediately for subsequent location screen loads.

FR-13. If no locations are visible for a module (all hidden or none configured), the location screen displays: "No locations available. Check hidden locations."

## 6. Data Model

### Our side (new table): `module_location_visibility`
| Field       | Type    | Notes                                      |
|-------------|---------|--------------------------------------------|
| module      | string  | e.g. `"sales-rate"`                        |
| location_id | integer | ActiveOne location ID                      |
| hidden      | boolean | true = hidden from location selection screen |

Composite primary key: (module, location_id).

Locations not present in this table are treated as visible by default — only explicitly hidden entries are stored.

### ActiveOne (existing)
- Location table: provides location_id and location name
- Inventory, sales, and PO tables: all have a location_id column used for scoping

## 7. API Contract

### GET /location/api
Fetches locations for a given module.

Request params:
- `module` (required) — the calling module identifier
- `showAll` (optional, boolean) — if true, returns all locations including hidden ones

Response: array of `{ id, name, hidden }` sorted by name.

### GET /sales-rate/api
Existing endpoint. Gains one new required parameter:
- `locationId` (integer) — scopes all inventory, sales, and incoming PO queries to this location.

Returns 400 if `locationId` is missing. Returns 404 if `locationId` does not exist in ActiveOne.

### POST /admin/api (or existing admin endpoint)
Toggles location visibility for a module.

Request body: `{ module, locationId, hidden }`.

Admin role required. Returns 403 if caller is not admin.

## 8. UI/UX Flow

### Location Selection Screen (`/location`)
1. User is redirected from a module (or navigates directly).
2. Screen displays a card grid of visible locations for the given module, each showing location name only.
3. "Show all locations" toggle at the top reveals hidden locations in muted styling.
4. User taps a card → redirected to `{returnTo}?locationId={id}`.
5. If no locations are visible, an inline message is shown: "No locations available. Check hidden locations."

### Sales Rate Flow (updated)
1. User navigates to `/sales-rate` with no `locationId` → redirected to `/location?module=sales-rate&returnTo=/sales-rate`.
2. User picks a location → lands on `/sales-rate?locationId=3`.
3. Selected location name is displayed in the page header.
4. All replenishment data (inventory, sales, incoming POs) is scoped to that location.
5. Generated PO is tagged with the same locationId in ActiveOne.
6. Remainder of the flow (review screen, summary screen) unchanged.

### Admin Location Management (`/admin`)
1. Admin navigates to `/admin`.
2. A "Location Visibility" section lists all ActiveOne locations grouped by module.
3. Each row has a toggle to hide/show that location for that module.
4. Changes save immediately (no submit button needed).

## 9. Edge Cases & Error Handling
- **Invalid locationId in URL**: sales-rate screen shows an error — "Location not found. Please select a valid location." with a link back to `/location?module=sales-rate&returnTo=/sales-rate`.
- **All locations hidden**: location screen shows "No locations available. Check hidden locations." — the "Show all" toggle is the recovery path.
- **ActiveOne returns no locations at all**: same message as above; "Show all" toggle would also return nothing — error is surfaced.
- **locationId missing from sales-rate URL**: redirect to location selection (FR-6).
- **Non-admin attempts to toggle visibility**: API returns 403; admin UI is not rendered for staff.

## 10. Open Questions
- OQ-1: What is the exact column name for location_id in the ActiveOne inventory, sales, and PO tables? Must be confirmed against live schema before implementation.
- OQ-2: Should the location name displayed in the sales-rate header be fetched fresh from ActiveOne, or returned alongside the replenishment data in the same API response?
- OQ-3: Do any other existing modules need location scoping immediately, or is sales-rate the only one for now?

## 11. Out of Scope / Deferred
- Per-location lead times
- Dedicated `/admin/locations` sub-route (consolidated into `/admin` for now)
- Multi-location session (ordering for more than one location at a time)
- Replenishment item count badge on location cards
- Location selection for modules other than `sales-rate` (architecture supports it, implementation deferred)
