# PRD: User & Role Management

Date: 2026-06-26

## 1. Overview

A new **Users** tab in the admin module (`/admin`) that lets administrators manage Operations Hub user accounts through the UI, replacing today's manual SQL seeding. Admins can create users, edit identity and role, reset passwords, activate/deactivate accounts, and link a user to their ActiveOne employee contact (which the Delivery module requires). A single permanent **system admin** ships with the app as a guaranteed break-glass account that can never be demoted or deactivated. A separate self-service "Change password" flow lets any logged-in user rotate their own password from the account menu.

## 2. Goals

- Replace manual SQL account seeding with a full in-app management UI.
- Let admins create, edit, deactivate/reactivate, and reset passwords for users without touching the database.
- Provide a typo-proof, validated way to link a user to an ActiveOne type-2 (employee) contact via a live searchable picker.
- Guarantee the system can never be fully locked out of admin access via a permanent, locked system-admin account.
- Let any user change their own password from the account menu without admin involvement.
- Match the existing tab-based `/admin` layout, design-system tokens, and Android touch targets.

## 3. Non-Goals

- **No hard delete** of users (deactivate only — preserves `delivery.received_by_user_id` references).
- **No audit log** of who-changed-what (deferred; only `created_at`/`updated_at` timestamps added).
- **No forced password change on first login** (no `must_change_password` flow).
- **No email/password-reset-link infrastructure** (none exists; admin sets passwords directly).
- **No immediate session revocation** — deactivation/role changes take effect at next login/token refresh, not on live sessions.
- **No password-complexity rules** beyond a minimum length.
- **No self-service editing** of name, username, role, or employee link — self-service is password-only.

## 4. Users & Roles

- **Admins only.** The Users tab lives under `/admin`, already gated to `role === "admin"` by `middleware.ts`. Non-admins are redirected to `/` and never see it.
- **Self-service password change** is available to **any authenticated user** (admin or staff) from the account menu.
- **System admin:** the shipped account flagged `is_protected = 1`. Permanently `role = admin` and `is_active = 1`; not editable or deactivatable from the Users tab; has no employee link. Can change its own password via self-service.
- **Regular admins:** full management rights, including the ability to demote or deactivate themselves (the system admin is the safety net).
- **Staff:** no access to the Users tab; can use self-service password change.

## 5. Functional Requirements

### User list
- **FR-1** The Users tab displays all users (active and inactive) as tap-friendly cards showing: display name, username, role badge, active/inactive state, and an employee-link indicator (resolved employee name, or raw code fallback, or "Not linked").
- **FR-2** Inactive users are shown but visually muted.
- **FR-3** A search box filters the list by display name or username (case-insensitive, partial match).
- **FR-4** The system admin card is visually identifiable as protected and exposes no edit/reset/deactivate controls.

### Create / edit
- **FR-5** A "New user" action opens a slide-up sheet with fields: display name, username, role (admin/staff), password, and an employee link picker. All except the employee link and (on edit) password are required.
- **FR-6** Tapping a regular user card's edit action opens the same sheet pre-filled. On edit, the password field is omitted (password changes go through the reset action).
- **FR-7** Creating a user requires a password of **minimum 8 characters**, with a show/hide toggle.
- **FR-8** Username and display name are editable for regular users. Username changes are validated for uniqueness.
- **FR-9** Role is changed inside the edit sheet and requires a confirm dialog when granting admin (staff→admin).
- **FR-10** The system admin cannot be created, edited (name/username/role/employee), or deactivated through any UI path.

### Employee link
- **FR-11** The employee link field is a searchable picker populated with **live ActiveOne type-2 (employee) contacts**, searchable by name; selecting one stores that contact's code in `employee_code`.
- **FR-12** The employee link is **optional** and **not unique** — the same employee may be linked to multiple users, and a user may have no link.
- **FR-13** A previously linked employee that no longer resolves in ActiveOne still displays its stored raw code; the link is never auto-cleared.

### Reset password (admin)
- **FR-14** A "Reset password" action (on the card menu / edit sheet) opens a focused dialog to set a new password (minimum 8 chars, show/hide toggle), separate from the main edit form.
- **FR-15** Reset password is unavailable for the system admin (it rotates its own password via self-service only).

### Activate / deactivate
- **FR-16** Each regular user card has a quick activate/deactivate toggle. Deactivation requires a confirm dialog.
- **FR-17** Deactivating a user (`is_active = 0`) blocks **new** logins immediately; existing sessions persist until next login/token refresh.
- **FR-18** The system admin cannot be deactivated.

### Self-service password change
- **FR-19** The account menu (header dropdown, every authenticated page) includes a "Change password" item available to all roles.
- **FR-20** Self-service change requires the user's **current password** plus a **new password** (minimum 8 chars); a wrong current password is rejected.
- **FR-21** After a successful self-service change, the user's current session **stays active** (only the stored hash updates) — no forced re-login.

### Enforcement
- **FR-22** Role and active-status changes are enforced at **next login / token refresh** (JWT strategy), not on live sessions.

## 6. Data Model

Extends the existing app-owned `users` table (never ActiveOne). No new tables.

| Column | Type | Notes |
|---|---|---|
| `id` | int unsigned PK | Existing. |
| `name` | varchar(100) | Display name. Existing. |
| `username` | varchar(50) unique | Login credential. Existing. Editable (except system admin). |
| `password_hash` | varchar(255) | bcrypt. Existing. |
| `role` | varchar(10) | `'admin'` \| `'staff'`, default `'staff'`. Existing. |
| `is_active` | tinyint(1) | Default 1. Existing. Soft-delete flag. |
| `employee_code` | varchar(50) NULL | ActiveOne type-2 contact code. Existing. Optional, non-unique. |
| `is_protected` | tinyint(1) | **New.** Default 0. `1` = locked system admin. |
| `created_at` | datetime | **New.** Defaults to `CURRENT_TIMESTAMP`. |
| `updated_at` | datetime | **New.** `CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`. |

- New columns added via the same **idempotent ALTER pattern** already used for `employee_code` in `create-app-tables.sql`.
- The shipped admin seed (`seed-app-bootstrap.sql`) sets `is_protected = 1`.
- **Employee source:** ActiveOne `Contact` table, type-2 (employee). Read-only, resolved live for the picker and for display-name resolution; never copied/cached into our schema beyond the stored `employee_code`.

## 7. API Contract

All routes live under `/admin/api/...` (admin-gated) except self-service, which is account-scoped. HTTP adapters resolve use cases from `container.ts`; no business logic in routes. GET reads only; mutations return minimal confirmation (Command-Query Separation).

### List users
- **GET `/admin/api/users`**
- Response: `{ users: [{ id, name, username, role, isActive, employeeCode, employeeName | null, isProtected }] }` — `employeeName` resolved live from ActiveOne where the code matches.

### Employee picker search
- **GET `/admin/api/users/employees?q={search}`**
- Response: `{ employees: [{ code, name }] }` — live ActiveOne type-2 contacts matching the query.

### Create user
- **POST `/admin/api/users`**
- Request: `{ name, username, role, password, employeeCode | null }`
- Response: `201 { id }` on success; `409 { error: "Username already taken" }` on collision; `400 { error }` on validation failure (missing fields, password < 8).

### Edit user
- **PUT `/admin/api/users/{id}`**
- Request: `{ name, username, role, employeeCode | null }` (no password here).
- Response: `200 { ok: true }`; `409` on username collision; `403 { error }` if target is `is_protected`; `400` on validation failure.

### Reset password (admin)
- **PUT `/admin/api/users/{id}/password`**
- Request: `{ password }` (min 8).
- Response: `200 { ok: true }`; `403` if target is `is_protected`; `400` on validation failure.

### Activate / deactivate
- **PUT `/admin/api/users/{id}/active`**
- Request: `{ isActive: boolean }`
- Response: `200 { ok: true }`; `403` if target is `is_protected` and `isActive = false`.

### Self-service change password
- **PUT `/account/api/password`** (authenticated, any role; scoped to the caller's own account from session)
- Request: `{ currentPassword, newPassword }` (newPassword min 8).
- Response: `200 { ok: true }`; `400 { error: "Current password is incorrect" }`; `400` if newPassword < 8.

## 8. UI/UX Flow

### Admin — Users tab
1. Admin opens `/admin` → selects the **Users** tab (added alongside General and Order Scheduling).
2. The tab shows a search box and a card list of all users. The system admin card is marked protected (no action controls).
3. **Create:** tap "New user" → slide-up sheet → fill name, username, role, password (show/hide), optionally search & pick an ActiveOne employee → Save → sheet closes, list refreshes, new card appears.
4. **Edit:** tap a regular user card's edit → sheet pre-filled (no password field) → adjust name/username/role/employee → Save. Granting admin prompts a confirm dialog.
5. **Reset password:** from the card menu or edit sheet → focused dialog → enter new password (show/hide, min 8) → Save.
6. **Deactivate/reactivate:** quick toggle on the card. Deactivate prompts a confirm dialog; the card then renders muted.

### Any user — self-service password
1. From the header **account menu** (present on every authenticated page) → "Change password".
2. Dialog requests current password + new password (show/hide, min 8).
3. On success: confirmation message, dialog closes, session continues uninterrupted.

### Design / platform
- Cards and the slide-up sheet use existing shadcn primitives in `app/shared/ui/` and semantic design tokens only. Role badge uses token colors; 48px minimum touch targets; motion gated behind `prefers-reduced-motion`.

## 9. Edge Cases & Error Handling

| Case | Expected response |
|---|---|
| Create/edit with a username already in use | `409`, inline error "Username already taken"; form stays open. |
| Password < 8 chars (create/reset/self-service) | `400`, inline validation error; no write. |
| Any UI attempt to edit/deactivate/reset the system admin | Controls not rendered; API also rejects with `403` as defense-in-depth. |
| Linked ActiveOne employee later removed/renamed | Card shows stored raw `employee_code`; link not auto-cleared. |
| Employee picker search with no matches | Picker shows "No employees found"; link remains unset. |
| Regular admin deactivates/demotes themselves | Allowed; takes effect at their next login/token refresh; system admin remains as safety net. |
| Deactivated user with a live session | Retains access until next login/token refresh; new logins blocked immediately. |
| Self-service change with wrong current password | `400`, "Current password is incorrect"; no change. |
| Empty employee link on a user who later receives a delivery | Allowed here; Delivery blocks *its own* save when `employee_code` is NULL (unchanged behavior). |
| Concurrent edits to the same user | Last write wins (no optimistic concurrency for user management at this stage). |

## 10. Open Questions

- None outstanding. All design decisions resolved during brainstorm.

## 11. Out of Scope / Deferred

- Who-did-what **audit log** for user-management actions (timestamps only for now).
- **Forced password change on first login** (`must_change_password`).
- **Immediate** session revocation / live role enforcement (currently next-login).
- **Hard delete** of users.
- **Password-complexity** policy beyond minimum length.
- **Email-based** password reset / invitation links.
- **Self-service editing** of profile fields other than password.
- **Uniqueness enforcement** on employee links (intentionally allowed to duplicate).
