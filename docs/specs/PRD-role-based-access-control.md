# PRD: Role-Based Access Control (Roles & Permissions)

Date: 2026-07-04

## 1. Overview

Replace the hardcoded two-value role enum (`admin` | `staff`) with a dynamic
role-based access control (RBAC) system. Admins can create, edit, and delete
**roles**; each role carries an **access list** of granular permissions drawn
from a **fixed, code-defined catalog** (module access, in-module supervisor
actions, and per-tab admin capabilities). A user can hold **multiple roles**;
their effective permissions are the **union**. Roles are assigned from both
directions — open a user and assign roles (exists today), or open a role and
manage its members. This system also **absorbs** the per-action admin-password
step-up gates in Delivery and Counting: those actions become role permissions
checked against the logged-in user, with no password re-entry.

## 2. Goals

- Admins can CRUD roles and toggle a fixed catalog of permissions per role.
- A user can hold multiple roles; effective access = union of their roles' permissions.
- Two-way assignment: assign roles from the user sheet, and assign users from the role sheet.
- Granular control over module access, in-module supervisor actions, and each admin tab.
- Preserve today's behavior via seeded roles (Administrator, Staff) and a locked, break-glass system admin.
- Every permission is enforced **server-side** (API/use-case layer), not just hidden in the UI.
- Zero-access users get a clear empty state instead of a blank screen.

## 3. Non-Goals

- **No admin-definable permissions.** The permission catalog is fixed in code; admins cannot invent new permission types.
- **No permission-change audit log** in v1 (deferred, consistent with the user-management PRD).
- **No cross-user "authorize-as" / walk-over authentication.** Only the logged-in user's permissions count; the old "any active admin authenticates on this device" flow is removed.
- **No change to Save-gate data requirements.** Delivery still requires an ActiveOne employee link; Counting still requires employee + login-user links. These are attribution requirements, not RBAC permissions — "any role may Save."
- **No live/immediate propagation.** Permission changes take effect at next login (JWT), matching current role/active enforcement.
- **No changes to ungated actions:** pure scanning, undo-last-scan, and self-service Change Password remain available to all authenticated users.

## 4. Users & Roles

- **Administrator (seeded, protected):** always holds every permission; role existence and permission set are locked (cannot be edited or deleted). Its **membership is editable** — admins may grant/revoke Administrator to other users.
- **System admin account (`is_protected = 1`):** permanently pinned to the Administrator role; cannot be removed from it. Guarantees at least one full-access account (break-glass), so no "last admin" guard is needed.
- **Staff (seeded):** granted Open Delivery, Open Counting, Open Replenishment only — no admin, no supervisor actions. Reproduces today's staff behavior.
- **Custom roles:** any admin with **Manage Roles** can create additional roles with any subset of catalog permissions.
- **Managing RBAC** requires the **Manage Roles** permission (roles) and **Manage Users** permission (user↔role assignment from the user side).

## 5. Functional Requirements

### Roles
- **FR-1** A user with Manage Roles can create a role with: a unique name, an optional description, an active flag (default active), and a selected set of permissions.
- **FR-2** Role names must be unique; a collision returns a specific `409` ("Role name already taken"). The name "Administrator" is reserved.
- **FR-3** A user with Manage Roles can edit a non-protected role's name, description, active flag, and permission set.
- **FR-4** The Administrator role's name, description, and permission set are immutable and its permissions always equal the full catalog; the API rejects mutations to them with `403`.
- **FR-5** Deleting a role is **blocked while any user holds it**; the UI shows the member count and requires reassignment first. Attempted deletion of an in-use role returns `409`. The Administrator role can never be deleted.
- **FR-6** A role can be **disabled** (active = false). A disabled role contributes **no permissions** to any holder's union. The Administrator role cannot be disabled.

### Permissions (fixed catalog)
- **FR-7** The permission catalog is defined once in `app/shared/domain/` as the single source of truth (permission keys + display labels + grouping). Toggling a permission that is not in the catalog is impossible.
- **FR-8** Catalog (grouped granularity):
  - **Module access:** Open Delivery, Open Counting, Open Replenishment, View History. *(Open Invoice, Open Transfer reserved for when those modules ship — inactive.)*
  - **Supervisor actions:** Adjust/Delete Delivery Lines; Approve Delivery Discrepancies & Return Excess; Adjust/Delete Counting Lines.
  - **Admin tabs:** Manage Users, Manage Roles, Order Scheduling, Selling Areas, Location Visibility, Delivery Settings, Counting Settings, Sales Rollup, General Settings.

### Assignment
- **FR-9** From the **user** sheet (Users tab), an admin with Manage Users can assign/unassign any number of roles to a user (multi-select).
- **FR-10** From the **role** sheet (Roles tab), an admin with Manage Roles can add/remove users as members of that role. Both directions write the same user↔role association.
- **FR-11** A user may hold **zero** roles; such a user can log in but has no permissions (empty launcher, all gates closed).
- **FR-12** The protected system account cannot be removed from the Administrator role from either direction.

### Effective permissions & enforcement
- **FR-13** A user's effective permissions = the union of permissions across all their **active** roles.
- **FR-14** Effective permissions are computed at **sign-in** and embedded in the JWT; permission/role/membership changes take effect on the user's **next login**.
- **FR-15** Middleware (edge) gates routes from the JWT permissions: `/admin` requires **any** admin-tab permission; `/history` requires View History; module routes require the corresponding Open-* permission. Unauthorized access redirects to `/` (or `/login` if unauthenticated).
- **FR-16** Inside the Admin area, each tab is shown/enabled only if the user holds that tab's permission; server routes for each tab re-check the permission.
- **FR-17** The home launcher renders a module card only if the user holds that module's Open-* permission. A user with no module permissions sees a "No modules assigned — contact an administrator" empty state.
- **FR-18** Every permission-gated action is **re-checked server-side** in the API/use-case layer, independent of UI hiding.

### Absorbed step-up gates (Delivery & Counting)
- **FR-19** Adjusting or deleting a Delivery line requires the "Adjust/Delete Delivery Lines" permission on the logged-in user. If held, the action proceeds with **no password prompt**; if not held, the control is hidden/disabled. Server rejects the mutation if the committing user lacks it.
- **FR-20** Approving blind-delivery discrepancies (Over / Not-Ordered) and Return Excess require the "Approve Delivery Discrepancies & Return Excess" permission on the logged-in user, with no password prompt. Blind-mode save stays **blocked** until a user holding this permission performs the approval; the approver recorded in the audit is that logged-in user. Server commit rejects an approval unless the committing user holds the permission (alongside the existing exact-line-match and original-PO-still-open checks).
- **FR-21** Adjusting or deleting a Counting line requires the "Adjust/Delete Counting Lines" permission, same UI/server rules as FR-19.
- **FR-22** The per-action admin-password modal and the blind-delivery "admin username+password unlock" UI are removed; access is governed purely by the logged-in user's permissions.

### Sensitive-grant confirmation
- **FR-23** Granting any admin-tab permission, any supervisor-action permission, or Administrator-role membership prompts a confirmation dialog before it is applied (mirrors today's staff→admin confirm).

### Migration
- **FR-24** On migration: seed Administrator (all permissions, protected, active) and Staff (Open Delivery/Counting/Replenishment). Map every existing `role = 'admin'` user to Administrator and every `role = 'staff'` user to Staff. Pin the `is_protected` account to Administrator.

## 6. Data Model

New app-owned tables (idempotent ALTER/CREATE pattern in `create-app-tables.sql`; never ActiveOne tables).

**`role`**
| Column | Type | Notes |
|---|---|---|
| `id` | integer PK, auto | |
| `name` | varchar, unique | "Administrator" reserved |
| `description` | varchar nullable | shown in UI |
| `is_protected` | tinyint(1) default 0 | Administrator = 1; locked from edit/delete/disable |
| `is_active` | tinyint(1) default 1 | disabled role contributes no permissions |
| `created_at` / `updated_at` | datetime | |

**`role_permission`** — one row per granted permission
| Column | Type | Notes |
|---|---|---|
| `role_id` | integer FK → role | |
| `permission_key` | varchar | must exist in the code catalog |
| PK | (`role_id`, `permission_key`) | |

**`user_role`** — many-to-many membership
| Column | Type | Notes |
|---|---|---|
| `user_id` | integer FK → users | |
| `role_id` | integer FK → role | |
| PK | (`user_id`, `role_id`) | |

**`users`** — the legacy `role varchar(10)` column is migrated into `user_role`, then dropped (or retained inert during transition per the idempotent pattern).

**Permission catalog** — defined in code (`app/shared/domain/`), not a table: an enumerated list of `permission_key` values with labels and group headings. `role_permission.permission_key` values are validated against it; unknown keys are ignored at resolution time.

## 7. API Contract

All under the module convention (`/admin/api/...`); each route re-checks the caller's permission server-side.

**Roles**
- `GET /admin/api/roles` → `{ roles: [{ id, name, description, isProtected, isActive, permissions: string[], memberCount }] }`. Requires Manage Roles.
- `POST /admin/api/roles` → body `{ name, description?, isActive?, permissions: string[] }` → `201 { id }` | `409` (name taken). Requires Manage Roles.
- `PUT /admin/api/roles/{id}` → body `{ name?, description?, isActive?, permissions? }` → `200` | `403` (protected) | `409` (name taken). Requires Manage Roles.
- `DELETE /admin/api/roles/{id}` → `200` | `403` (protected) | `409` (in use, with member count). Requires Manage Roles.
- `GET /admin/api/roles/{id}/members` → `{ members: [{ userId, name, username }] }`. Requires Manage Roles.
- `PUT /admin/api/roles/{id}/members` → body `{ userIds: number[] }` (full set) or add/remove deltas → `200`. Rejects removing the protected account from Administrator (`403`). Requires Manage Roles.

**Users (extends existing Users API)**
- `GET /admin/api/users` → each user now includes `roleIds: number[]` (+ resolved role names for display).
- `PUT /admin/api/users/{id}` (or a dedicated `.../roles` sub-route) accepts `roleIds: number[]` to set the user's roles. Rejects unpinning the protected account from Administrator. Requires Manage Users.

**Permission catalog**
- `GET /admin/api/permissions` → the grouped catalog `[{ group, permissions: [{ key, label }] }]` for rendering the role editor. Requires Manage Roles.

**Auth**
- Sign-in resolves the union of active-role permissions and writes `permissions: string[]` into the JWT; `session.user.permissions` exposes it. The legacy `role` claim is removed or derived.

## 8. UI/UX Flow

**Roles tab (new, in `/admin`)** — gated by Manage Roles; follows the Users-tab pattern.
1. Card list of roles (search by name; disabled roles muted; Administrator badged "Protected"). Each card shows name, description, member count, and a permission-count/summary.
2. "New role" opens a slide-up sheet: name, description, active toggle, and the **permission catalog grouped by heading** (Module access / Supervisor actions / Admin tabs) as labeled checkboxes.
3. Editing a role opens the same sheet pre-filled. For the Administrator role the sheet is read-only except its member list.
4. **Members** section in the sheet: searchable list of assigned users with add/remove. The protected system account is shown locked in Administrator.
5. Toggling on a sensitive permission (admin-tab or supervisor) prompts a confirm before it's staged; saving persists on confirm.
6. Deleting a role with members is blocked with a message ("N users hold this role — reassign first").
7. A persistent notice: "Changes apply the next time affected users sign in."

**Users tab (extended)**
- The user sheet's single role selector becomes a **multi-select role assignment** (checkbox list of roles). Granting Administrator or a sensitive-permission role prompts the same confirm. The protected account's Administrator assignment is locked.

**Home launcher**
- Cards filtered to the user's Open-* permissions. Zero module permissions → empty-state message.

**Delivery / Counting**
- Line-edit/delete and discrepancy-approval controls appear only for users holding the relevant permission; when present they act immediately (no password modal). When absent, controls are hidden/disabled and blind-mode save stays blocked until a permitted user acts.

## 9. Edge Cases & Error Handling

- **Zero-role active user:** logs in successfully, sees empty launcher + guidance; all routes/actions gated. No error.
- **Disabled role:** holders keep the role association but gain none of its permissions at next login; if it was their only role they become effectively zero-access.
- **Delete role in use:** `409` + member count; UI directs to reassignment.
- **Mutating the Administrator role's permissions/name/active/deletion:** `403`.
- **Removing the protected account from Administrator (either direction):** `403`.
- **Duplicate role name:** `409` "Role name already taken."
- **Unknown permission key** in stored data (e.g., a removed catalog entry): ignored during resolution; never grants access.
- **Permission changed while user is logged in:** no live effect; applies at next sign-in (documented in UI).
- **User acts without permission via direct API call:** server re-check rejects with `403` even if the UI would have hidden the control.
- **Reserved modules (Invoice/Transfer) Open-* permissions:** grantable but inert until those modules ship; granting has no effect on stubs.

## 10. Open Questions

- None outstanding. (Whether to physically drop the legacy `users.role` column immediately or retain it inert during transition is an implementation detail to decide during the migration step.)

## 11. Out of Scope / Deferred

- Permission-change **audit log** (who changed which role/membership and when) — deferred, consistent with the user-management PRD.
- **Admin-definable permissions** — the catalog stays code-defined.
- **Cross-user authorize-as / walk-over authentication** for approvals — removed, not replaced.
- **Immediate/live permission propagation** — remains next-login (JWT).
- Open-* permissions for **Invoice/Transfer** are reserved but non-functional until those modules are built.
