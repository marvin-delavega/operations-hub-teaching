# PRD: Application Naming
Date: 2026-06-17

## 1. Overview
The application is currently named "GreatwallScanningApp", a placeholder that no longer reflects its actual scope. The app bridges operational gaps in the ActiveOne ERP — covering delivery tracking, inventory counting, invoicing, stock transfers, and replenishment planning. This PRD defines the official name, technical identifier, display conventions, and the mechanism for surfacing a configurable company name throughout the UI.

## 2. Goals
- Establish a permanent, accurate name for the application across all surfaces (UI, browser tab, codebase, documentation).
- Decouple the app name from any specific company brand, making it reusable for other deployments.
- Allow the company name to be configured by an admin and rendered as a prefix in page titles.
- Ensure consistent naming conventions across the project.

## 3. Non-Goals
- This PRD does not cover renaming the GitHub repository (that is an infrastructure action, not an app change).
- This PRD does not cover multi-tenant or white-label support beyond a single configurable company name.
- This PRD does not define other `app_settings` fields beyond the company name.

## 4. Users & Roles
- **Admin** — can read and update the company name setting via `/admin`.
- **Staff** — benefits from the company name display passively; no interaction required.

## 5. Functional Requirements

**FR-1** — The application's full display name is **Operations Hub**.

**FR-2** — The application's short display name is **Ops Hub**. Used wherever space is constrained (e.g., mobile header, icon label).

**FR-3** — The application's technical identifier is **OperationsHub**. Used in: package name, project folder name, code references, and internal documentation.

**FR-4** — All browser `<title>` tags follow the pattern: `{Company Name} · Ops Hub · {Module Name}`, using the middle dot character `·` (U+00B7) as the separator.

**FR-5** — The company name is stored in the `app_settings` database table as a key-value row with key `company_name`.

**FR-6** — The company name is fetched once at the root layout level (Next.js `app/layout.tsx`) and passed down to all pages. It is not re-fetched on every page render.

**FR-7** — The fetched company name is cached using Next.js caching primitives (e.g., `cache()` or `unstable_cache`) to avoid redundant DB reads across requests.

**FR-8** — An admin can update the company name from the `/admin` module. The update is persisted to the `app_settings` table.

**FR-9** — On cache miss or first load, the app falls back to a default company name of `"Operations Hub"` if `company_name` is not found in `app_settings`.

**FR-10** — The company name does **not** appear in the app's primary navigation or branding elements — only in the `<title>` tag (and any future localization surfaces as defined separately).

## 6. Data Model

### Table: `app_settings`
Stores application-wide configuration as key-value pairs.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `key` | VARCHAR(100) | PRIMARY KEY | Setting identifier (e.g., `company_name`) |
| `value` | TEXT | NOT NULL | Setting value |
| `updated_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE | Last updated timestamp |

**Seed row:**
- key: `company_name`, value: `"Great Wall Trading"`

## 7. API Contract

### GET `/admin/api/settings`
Returns all app settings.

**Response:**
```
{
  "settings": {
    "company_name": string
  }
}
```

### PUT `/admin/api/settings`
Updates one or more app settings.

**Request body:**
```
{
  "company_name": string   // optional; trimmed, max 100 chars
}
```

**Response:**
```
{ "success": true }
```

**Error response (validation failure):**
```
{ "error": "company_name must be 100 characters or fewer" }
```
HTTP 400.

## 8. UI/UX Flow

### Page Title (all pages)
1. Root layout fetches `company_name` from `app_settings` (cached).
2. Each page composes the title: `{company_name} · Ops Hub · {Module Name}`.
3. If `company_name` is empty or missing, default to `"Operations Hub"` so the title reads: `Operations Hub · Ops Hub · {Module Name}`.

### Admin — Company Name Setting
1. Admin navigates to `/admin`.
2. A "Company Name" field is visible in the application settings section.
3. The current value is pre-populated from `app_settings`.
4. Admin edits the value and saves.
5. On success, a confirmation toast is shown.
6. The cache is invalidated so the next page load reflects the updated name.

## 9. Edge Cases & Error Handling

| Scenario | Expected Behavior |
|---|---|
| `app_settings` table is empty / row missing | Fall back to default: `"Operations Hub"` |
| Company name is blank string | Treat as missing; use default |
| Company name exceeds 100 characters | Reject at API boundary with HTTP 400 and descriptive error |
| DB unavailable during layout fetch | Silently use default; do not crash the page render |
| Cache stale after admin update | Invalidate cache on successful PUT; next request re-fetches |

## 10. Open Questions
None. All decisions resolved during brainstorm.

## 11. Out of Scope / Deferred
- Renaming the GitHub repository to `OperationsHub`.
- Additional `app_settings` fields (e.g., default location, date format) — table supports them but are not defined here.
- Multi-language or full i18n support — company name substitution is the only localization in scope.
- App icon / splash screen branding for Android home screen.
