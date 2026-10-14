# PRD: Landing Page and Main Menu
Date: 2026-06-17

## 1. Overview
The landing page at `/` is the module launcher for Greatwall Scanning App. After login, all users land here and select the module they want to work in. It replaces any previous `/dashboard` concept and serves as the persistent home base of the app. The page is designed for tap-first use on Android mobile and tablet browsers.

## 2. Goals
- Provide a fast, tap-friendly module selection screen optimized for Android mobile/tablet browsers.
- Show only the modules the logged-in user's role permits.
- Communicate clearly which modules are available vs. coming soon.
- Give users a consistent way to return home from any module.

## 3. Non-Goals
- Does not display any operational data, metrics, or activity summaries.
- Does not replace the `/location` utility flow — location selection remains triggered per-module.
- Does not include a bottom navigation bar.
- Does not include usage-based ordering or personalization.

## 4. Users & Roles
- **Staff** — sees 6 module cards: Delivery, Counting, Invoice, Transfer, Sales Rate, History.
- **Admin** — sees all 6 staff modules plus an Admin card (7 total).
- Both roles see greyed-out "Coming Soon" cards for unimplemented modules.

## 5. Functional Requirements
- **FR-1:** The landing page lives at `/`. After a successful login, the user is redirected to `/`.
- **FR-2:** The middleware redirect for non-admins attempting to access `/admin/*` points to `/` (not `/dashboard`).
- **FR-3:** The page header displays: app name ("Greatwall Scanning App" on the left), the logged-in user's name, and a Logout button on the right.
- **FR-4:** Below the header, a "Welcome, [name]" heading is displayed.
- **FR-5:** Module cards are arranged in a responsive grid (2 columns on mobile, 3 on tablet).
- **FR-6:** Each card displays: a lucide-react icon, the module name, and a short description.
- **FR-7:** Active modules are fully tappable and navigate to their respective route on tap.
- **FR-8:** Stub modules are visually greyed out, non-tappable, and display a "Coming Soon" badge.
- **FR-9:** Admin role sees an additional Admin card at the end of the grid; staff role does not.
- **FR-10:** Module order is fixed (see Section 8 for order); reordering is deferred.
- **FR-11:** The browser tab title on the landing page is "Greatwall Scanning App".
- **FR-12:** Each module page sets its browser tab title to "[Module Name] — Greatwall Scanning App".
- **FR-13:** All module pages include a Home button in their page header that navigates to `/`.
- **FR-14:** Tapping the Logout button ends the session and redirects to `/login`.

## 6. Data Model
No new database tables are required. Module metadata (name, description, icon, route, active status, required role) is a static configuration defined in the frontend. The logged-in user's name and role are read from the existing NextAuth session.

## 7. API Contract
No new API endpoints are required. The landing page reads the session via NextAuth's `auth()` and renders the module list based on role. No network requests beyond session resolution.

## 8. UI/UX Flow

### Landing Page (`/`)
1. User arrives after login (or taps Home from within a module).
2. Header bar: app name on the left, logged-in user's name and Logout button on the right.
3. "Welcome, [name]" heading below the header.
4. Responsive card grid below the heading.

**Card order (fixed):**

| # | Module     | Icon (lucide-react)  | Description                                                  | Status  | Roles      |
|---|------------|----------------------|--------------------------------------------------------------|---------|------------|
| 1 | Delivery   | `Truck`              | Scan and receive incoming deliveries from suppliers.         | Stub    | All        |
| 2 | Counting   | `ClipboardList`      | Perform physical inventory counts and reconcile stock.       | Stub    | All        |
| 3 | Invoice    | `Receipt`            | Review and process supplier invoices.                        | Stub    | All        |
| 4 | Transfer   | `ArrowLeftRight`     | Move stock between warehouse locations.                      | Stub    | All        |
| 5 | Sales Rate | `TrendingUp`         | Plan replenishment orders based on daily sales rate.         | Active  | All        |
| 6 | History    | `History`            | View past scan transactions and activity logs.               | Stub    | All        |
| 7 | Admin      | `Settings`           | Manage system settings and location visibility.              | Active  | Admin only |

### Active Card
- Full color, tappable, navigates to the module route on tap.

### Stub Card
- Greyed out, non-tappable, "Coming Soon" badge visible (small pill below the description or overlaid on the card).

### Module Pages (all existing and future modules)
- Header includes: Home button on the left, module name in the center, module-specific controls on the right.
- Browser tab title: "[Module Name] — Greatwall Scanning App".

## 9. Edge Cases & Error Handling
- **Session expired on landing page** — middleware already handles this; user is redirected to `/login`.
- **Non-admin accessing `/admin/*`** — middleware redirects to `/` (updated from `/dashboard`).
- **Admin card rendered for staff** — prevented by role check at render time; the card is simply not included in the staff module list.
- **Future module added as stub** — add an entry to the static module config with `active: false`; it appears greyed out automatically with no other changes required.

## 10. Open Questions
- Should "Welcome, [name]" use the user's first name only or full name? Depends on what is stored in the NextAuth session — likely full name from ActiveOne credentials.
- Should the "Coming Soon" indicator be a badge overlaid on the card corner, or a line of muted text below the description?

## 11. Out of Scope / Deferred
- Usage-based or user-configurable module ordering.
- A bottom navigation bar.
- Module-level notification badges (e.g. "3 pending deliveries") on landing page cards.
- Branding logo image — text name only for now.
- App name change — deferred; current name is "Greatwall Scanning App".
