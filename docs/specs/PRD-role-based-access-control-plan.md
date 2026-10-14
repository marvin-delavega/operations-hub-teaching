# Implementation Plan: Role-Based Access Control (Roles & Permissions)
Source PRD: [PRD-role-based-access-control.md](PRD-role-based-access-control.md)
Date: 2026-07-04

## Summary
Replace the hardcoded `admin | staff` role enum with a dynamic RBAC system: app-owned `role` / `role_permission` / `user_role` tables, a **code-defined fixed permission catalog** in `app/shared/domain/`, and effective permissions resolved as the **union of a user's active roles** into the JWT at sign-in. A new **Roles** admin tab CRUDs roles and their permissions with two-way membership; the Users tab becomes multi-select over roles. Middleware, the home launcher, admin tabs, and every gated API re-check permissions server-side. The change also **removes** the cross-user admin-password step-up in Delivery and Counting — those actions become permission checks on the *logged-in* user (no password re-entry, no authorize-as), which lets us delete the whole verify-admin / admin-unlock / approval-proof machinery and simplify the delivery commit gate to "the committer holds the approve permission."

## Affected Areas

### Shared (cross-cutting) — `app/shared/`
- **New** [permissions.ts](../../app/shared/domain/permissions.ts) — the fixed catalog SSOT: `PermissionKey` type, `PERMISSION_CATALOG` (grouped), `ALL_PERMISSION_KEYS`, and pure helpers `hasAnyAdminTabPermission()`, `requiredPermissionForPath()`, `isSensitivePermission()`. Edge-safe (no DB import).
- [UserRole.ts](../../app/shared/domain/UserRole.ts) — repurpose the NextAuth module augmentation: replace `role: UserRole` with `permissions: string[]` and add `roleNames: string[]` on `User` / `Session["user"]` / `JWT`. Keep `rememberMe`. The `UserRole` type itself is retired.
- **New** [resolveUserPermissions.ts](../../app/shared/infrastructure/resolveUserPermissions.ts) — raw-SQL resolution `(userId) → { permissions, roleNames }` over `user_role` / `role` / `role_permission`; a **protected (Administrator) role contributes the entire code catalog** (FR-4 auto-sync), other active roles contribute their stored keys filtered to the catalog. Disabled roles contribute no permissions but their names still appear in `roleNames`.
- [authConfig.ts](../../app/shared/infrastructure/authConfig.ts) / [auth.ts](../../app/shared/infrastructure/auth.ts) — JWT/session carry `permissions` + `roleNames`; `authorize()` calls `resolveUserPermissions`; dev backdoor grants `ALL_PERMISSION_KEYS`.
- [authEdge.ts](../../app/shared/infrastructure/authEdge.ts) + [middleware.ts](../../middleware.ts) — gate module/admin/history routes from `token.permissions` via the shared helpers.
- [AppHeader.tsx](../../app/shared/ui/AppHeader.tsx) / [AccountMenu.tsx](../../app/shared/ui/AccountMenu.tsx) — display `roleNames` (comma-joined) instead of the single `UserRole`; drop the `ROLE_LABEL` map.

### Admin module — `app/(authenticated)/admin/`
- **New RBAC slice**: `domain/Role.ts`, `domain/RoleRepository.ts`, `application/{GetRoles,CreateRole,UpdateRole,DeleteRole,GetRoleMembers,SetRoleMembers,SetUserRoles}UseCase.ts`, `application/RoleErrors.ts`, `infrastructure/MySQLRoleRepository.ts`.
- **New UI** `RolesTab.tsx`; [page.tsx](../../app/(authenticated)/admin/page.tsx) adds the Roles tab and gates all tabs by the caller's permissions; [UsersTab.tsx](../../app/(authenticated)/admin/UsersTab.tsx) → multi-select role assignment + sensitive-grant confirm.
- **New API** `api/roles/route.ts`, `api/roles/[id]/route.ts`, `api/roles/[id]/members/route.ts`, `api/permissions/route.ts`; **new** `api/requirePermission.ts` (replaces [requireAdmin.ts](../../app/(authenticated)/admin/api/requireAdmin.ts)).
- **Extend** users slice: [UserRepository.ts](../../app/(authenticated)/admin/domain/UserRepository.ts) (+`getRoleIds`/`setRoles`), [MySQLUserRepository.ts](../../app/(authenticated)/admin/infrastructure/MySQLUserRepository.ts), [Create/UpdateUserUseCase.ts](../../app/(authenticated)/admin/application/CreateUserUseCase.ts), [GetUsersUseCase.ts](../../app/(authenticated)/admin/application/GetUsersUseCase.ts), [users API routes](../../app/(authenticated)/admin/api/users/route.ts) — carry `roleIds` (+ display `roleNames`) instead of `role`.
- **Per-tab server gating** on existing admin routes (see step 8): [settings/route.ts](../../app/(authenticated)/admin/api/settings/route.ts) gates **per key**, [admin/api/route.ts](../../app/(authenticated)/admin/api/route.ts) (location visibility), rollup routes, order-scheduling, order-pooling, item-cache.

### Delivery module — `app/(authenticated)/delivery/`
- **Delete**: `application/AdminVerifier.ts`, `application/VerifyAdminUseCase.ts`, `application/AuthorizeDeliveryUnlockUseCase.ts`, `application/MintDeliveryApprovalUseCase.ts`, `infrastructure/MySQLAdminVerifier.ts`, `infrastructure/deliveryApprovalProof.ts`, `api/verify-admin/route.ts`, `api/admin-unlock/route.ts`, `api/approve/route.ts`.
- **Change**: `application/CommitDeliveryUseCase.ts` (approval gate → committer permission), `domain/Delivery.ts` (drop approval-proof types), [api/route.ts](../../app/(authenticated)/delivery/api/route.ts) (drop `approval` body, pass `canApproveDiscrepancies`, add capability flags to GET), `page.tsx` (remove password modals; drive controls off capability flags).

### Counting module — `app/(authenticated)/counting/`
- [api/route.ts](../../app/(authenticated)/counting/api/route.ts) — add `canAdjustLines` to the GET gate response; `page.tsx` — remove the admin-password modal (currently reuses `/delivery/api/verify-admin`) and drive edit/delete off the flag.

### Setup — `app/(setup)/`
- [layout.tsx](../../app/(setup)/layout.tsx) and `setup/api/{advance,finish,reset}/route.ts` — `role === "admin"` → `hasAnyAdminTabPermission(permissions)`.
- [(authenticated)/layout.tsx](../../app/(authenticated)/layout.tsx) — same substitution for the setup soft-wall / redirect branch.

### Home launcher
- [(authenticated)/page.tsx](../../app/(authenticated)/page.tsx) — filter cards by module `Open-*` / `View History` / any-admin-tab permission; "No modules assigned" empty state.

### Composition root
- [container.ts](../../container.ts) — add role/user-role factories; **remove** `createVerifyAdminUseCase`, `createAuthorizeDeliveryUnlockUseCase`, `createMintDeliveryApprovalUseCase`.

### DB / seed
- [scripts/create-app-tables.sql](../../scripts/create-app-tables.sql) — new `role` / `role_permission` / `user_role` tables (idempotent `CREATE TABLE IF NOT EXISTS`); `users.role` retained inert.
- [scripts/seed-app-bootstrap.sql](../../scripts/seed-app-bootstrap.sql) — seed Administrator (protected) + Staff roles, migrate existing `users.role` into `user_role`, pin the protected account to Administrator.

## Decisions

- **Resolved by AI — Legacy `users.role` retained inert, not dropped.** (PRD §10 leaves this an implementation detail.) Keep the column with its `DEFAULT 'staff'` so nothing that still writes it breaks; stop reading it for authorization. Matches the repo's additive, never-drop idempotent-ALTER convention.
- **Resolved by AI — Administrator permissions are resolved in code, not seeded row-by-row.** `resolveUserPermissions` grants `ALL_PERMISSION_KEYS` whenever an active role is `is_protected`. Satisfies FR-4 ("permissions always equal the full catalog") automatically as the catalog evolves, and keeps the code the single source of truth (no `role_permission` rows to keep in sync). `GET /admin/api/roles` reports the Administrator role's permissions as the full catalog.
- **Resolved by AI — Client learns its permissions two ways, matching existing patterns.** Server-rendered surfaces (middleware, both layouts, home launcher) read `session.user.permissions` directly. Client module pages (Delivery, Counting) receive **server-computed capability flags** in their existing `GET` responses (mirrors Counting's current `canSave`/`gateReason` gate) — server stays the authority. The client Admin page reads its own permissions via `getSession()` (NextAuth's promise API needs no `SessionProvider`, none exists today) to filter visible tabs; every admin route still re-checks server-side. No global `SessionProvider` is added (YAGNI).
- **Resolved by AI — Delivery discrepancy gate collapses to a committer check.** Because cross-user authorize-as is removed (Non-Goal), the committer *is* the approver. `CommitDeliveryUseCase` already recomputes Over/Not-Ordered lines and reads blind mode from settings; it now simply requires the committing user to hold `delivery.approve_discrepancies` when flagged lines exist, recording them as approver. This deletes the window-token / approval-proof / line-binding machinery entirely (the "new line or increase invalidates approval" rule is moot — the server re-derives flagged lines every commit).
- **Resolved by AI — Per-key permission checks in the shared settings route.** `PUT /admin/api/settings` mutates keys owned by three different tabs; it authorizes **each key** against its tab permission (`company_name`/`scan_batch_delay_ms` → `admin.general_settings`; `delivery_*` → `admin.delivery_settings`; `counting_continuous_scanning` → `admin.counting_settings`) rather than one blanket check. No endpoint split needed.
- **Resolved by AI — Keep the current admin tab layout; gate General's sub-sections individually.** The catalog has separate `admin.location_visibility` and `admin.general_settings` permissions, but Location Visibility currently lives inside the General tab. Rather than reorganize tabs, gate the Location-Visibility section by `admin.location_visibility` and the rest of General by `admin.general_settings`. Add only the new Roles tab.

- **Assumptions the implementer should know:**
  - Permission keys (proposed, stable strings): module — `module.delivery`, `module.counting`, `module.replenishment`, `module.history`, `module.invoice`*, `module.transfer`* (*reserved/inactive); supervisor — `delivery.adjust_lines`, `delivery.approve_discrepancies`, `counting.adjust_lines`; admin — `admin.users`, `admin.roles`, `admin.order_scheduling`, `admin.selling_areas`, `admin.location_visibility`, `admin.delivery_settings`, `admin.counting_settings`, `admin.sales_rollup`, `admin.general_settings`.
  - Sensitive permissions (trigger the FR-23 confirm) = every `admin.*` and every supervisor key; module keys are not sensitive. Administrator-role membership grants also confirm.
  - `item-cache/refresh` sits on the General tab → gated by `admin.general_settings`.
  - Setup wizard gates use "any admin-tab permission" (consistent with the middleware `/admin` gate).

## Implementation Steps

### 1. Permission catalog + session types (shared/domain)
- Create [permissions.ts](../../app/shared/domain/permissions.ts):
  - `export type PermissionKey = ...` (union of the keys above).
  - `PERMISSION_CATALOG: { group: string; permissions: { key: PermissionKey; label: string; reserved?: boolean }[] }[]` with groups **Module Access**, **Supervisor Actions**, **Admin Tabs**.
  - `ALL_PERMISSION_KEYS: PermissionKey[]` (active keys; reserved module keys included but flagged).
  - Pure helpers (no DB, edge-safe): `hasAnyAdminTabPermission(perms: string[])` (`some(p => p.startsWith("admin."))`), `requiredPermissionForPath(pathname: string): string | "ANY_ADMIN" | null`, `isSensitivePermission(key: string)`.
- Edit [UserRole.ts](../../app/shared/domain/UserRole.ts): swap `role` for `permissions: string[]` and `roleNames: string[]` in the three augmented interfaces. Rename file contents' intent; grep-fix all `UserRole` importers (they're all being rewritten in later steps).

### 2. Schema (create-app-tables.sql)
Append three `CREATE TABLE IF NOT EXISTS` blocks (InnoDB, utf8mb4_0900_ai_ci), no FKs into ActiveOne, mirroring the file's existing style:
- `role` (`id` PK auto, `name` varchar UNIQUE, `description` varchar NULL, `is_protected` tinyint default 0, `is_active` tinyint default 1, `created_at`/`updated_at`).
- `role_permission` (`role_id` int, `permission_key` varchar, PK(`role_id`,`permission_key`), FK `role_id`→`role` ON DELETE CASCADE).
- `user_role` (`user_id` int, `role_id` int, PK(`user_id`,`role_id`), FK `user_id`→`users` ON DELETE CASCADE, FK `role_id`→`role` ON DELETE CASCADE).
Leave `users.role` as-is (inert). No new idempotent ALTER needed (fresh tables).

### 3. Seed / migration (seed-app-bootstrap.sql, FR-24)
Idempotent upserts, run after create-app-tables.sql:
- Insert Administrator role (`is_protected=1`, `is_active=1`) and Staff role (`is_protected=0`) via `INSERT ... ON DUPLICATE KEY UPDATE name`.
- Staff `role_permission` rows: `module.delivery`, `module.counting`, `module.replenishment` (idempotent inserts). **No** Administrator `role_permission` rows (resolved in code).
- Map legacy enum → membership: `INSERT IGNORE INTO user_role SELECT u.id, r.id FROM users u JOIN role r ON r.name = (CASE u.role WHEN 'admin' THEN 'Administrator' ELSE 'Staff' END)`.
- Pin protected account: `INSERT IGNORE INTO user_role SELECT id, (SELECT id FROM role WHERE name='Administrator') FROM users WHERE is_protected=1`.

### 4. Sign-in permission resolution (shared/infrastructure)
- Create [resolveUserPermissions.ts](../../app/shared/infrastructure/resolveUserPermissions.ts): `async resolveUserPermissions(userId): Promise<{ permissions: string[]; roleNames: string[] }>`.
  - Query all assigned roles for the user (`user_role` JOIN `role`). `roleNames` = every assigned role's name.
  - `permissions` = union over **active** roles: protected role → spread `ALL_PERMISSION_KEYS`; else its `role_permission.permission_key` values ∩ catalog. Return sorted unique.
- [auth.ts](../../app/shared/infrastructure/auth.ts): after credential check, call `resolveUserPermissions(user.id)`; return `{ id, name, permissions, roleNames, rememberMe }` (drop `role`, drop the `SELECT ... role` from the credentials query). Dev backdoor → `permissions: ALL_PERMISSION_KEYS`, `roleNames: ["Administrator"]`.
- [authConfig.ts](../../app/shared/infrastructure/authConfig.ts): JWT callback copies `permissions`/`roleNames` on sign-in; session callback exposes them on `session.user`.

### 5. Middleware route gating (FR-15)
- [middleware.ts](../../middleware.ts): keep the public-paths short-circuit and the unauth→`/login` redirect. Replace the `ADMIN_PATHS`/`role !== "admin"` block with: `const need = requiredPermissionForPath(pathname); if (need && !satisfied(req.auth.user.permissions, need)) redirect("/")` where `need === "ANY_ADMIN"` ⇒ `hasAnyAdminTabPermission`. Map: `/admin`→ANY_ADMIN, `/history`→`module.history`, `/delivery`→`module.delivery`, `/counting`→`module.counting`, `/replenishment`→`module.replenishment`, `/invoice`→`module.invoice`, `/transfer`→`module.transfer`. `/location`, `/supplier`, `/setup`, `/account` stay session-only.
- Keep `authEdge` edge-safe: `permissions` already lives in the token; helpers are pure.

### 6. Roles domain / application / infrastructure (admin module)
- `domain/Role.ts`: `Role { id, name, description, isProtected, isActive, permissions: string[], memberCount }` and `RoleMember { userId, name, username }`.
- `domain/RoleRepository.ts` (port): `getAll()`, `findById()`, `nameExists(name, excludeId?)`, `create(input)`, `update(id, input)`, `delete(id)`, `memberCount(id)`, `getMembers(id)`, `setMembers(id, userIds[])`. Role CRUD also writes `role_permission` (replace-set on update).
- `application/RoleErrors.ts`: `RoleNameTakenError` (409), `RoleInUseError(memberCount)` (409), `ProtectedRoleError` (403), `RoleValidationError` (400).
- Use cases:
  - `GetRolesUseCase` — list with member counts; Administrator's `permissions` reported as `ALL_PERMISSION_KEYS`.
  - `CreateRoleUseCase` — validate name non-empty + not "Administrator" (reserved) + unique; filter `permissions` to catalog; default `isActive=true`.
  - `UpdateRoleUseCase` — reject if target `isProtected` (403); else update name/description/isActive/permissions (name uniqueness excl. self).
  - `DeleteRoleUseCase` — reject protected (403); reject if `memberCount > 0` (409 + count).
  - `GetRoleMembersUseCase` / `SetRoleMembersUseCase` — set membership; reject removing the protected account from Administrator (403).
  - `SetUserRolesUseCase` — set a user's roles from the user side; reject unpinning the protected account from Administrator (403). (Shares `user_role` writes with the role repo.)
- `infrastructure/MySQLRoleRepository.ts` — raw SQL; transaction for role+permissions and for membership replace-sets. Mirrors [MySQLUserRepository.ts](../../app/(authenticated)/admin/infrastructure/MySQLUserRepository.ts) style.

### 7. container.ts factories
- Add `createGetRolesUseCase`, `createCreateRoleUseCase`, `createUpdateRoleUseCase`, `createDeleteRoleUseCase`, `createGetRoleMembersUseCase`, `createSetRoleMembersUseCase`, `createSetUserRolesUseCase` (all wired to `new MySQLRoleRepository()`; `SetUserRolesUseCase` may also take `MySQLUserRepository`).
- Remove `createVerifyAdminUseCase`, `createAuthorizeDeliveryUnlockUseCase`, `createMintDeliveryApprovalUseCase` and their imports.

### 8. Admin API + guard (FR-16, FR-18, §7)
- **New** `api/requirePermission.ts`: `async requirePermission(key | "ANY_ADMIN"): Promise<boolean>` reading `auth()` session permissions. Replaces [requireAdmin.ts](../../app/(authenticated)/admin/api/requireAdmin.ts) (delete it; it has no importers — current routes inline the role check).
- **New** `api/roles/route.ts` — `GET` (Manage Roles) list; `POST` (Manage Roles) create → 201/409.
- **New** `api/roles/[id]/route.ts` — `PUT` (Manage Roles) → 200/403/409; `DELETE` (Manage Roles) → 200/403/409 (member count in body).
- **New** `api/roles/[id]/members/route.ts` — `GET` (Manage Roles); `PUT` (Manage Roles) set members → 200/403.
- **New** `api/permissions/route.ts` — `GET` (Manage Roles) returns `PERMISSION_CATALOG` for the editor.
- **Retrofit existing routes** to `requirePermission(...)`:
  - users/* → `admin.users`; order-scheduling/api → `admin.order_scheduling`; order-pooling → `admin.selling_areas`; rollup + rollup-schedule(+install) → `admin.sales_rollup`; item-cache/refresh → `admin.general_settings`.
  - [admin/api/route.ts](../../app/(authenticated)/admin/api/route.ts) `POST` (location visibility) → `admin.location_visibility`.
  - [settings/route.ts](../../app/(authenticated)/admin/api/settings/route.ts) `PUT` → **per-key** checks (see Decisions). Return 403 if a key is present without its permission.

### 9. Users slice extension (multi-role)
- [UserRepository.ts](../../app/(authenticated)/admin/domain/UserRepository.ts): drop `role` from `CreateUserInput`/`UpdateUserInput`; add `getRoleIds(userId): Promise<number[]>` and `setRoles(userId, roleIds: number[]): Promise<void>` (writes `user_role`, replace-set).
- [MySQLUserRepository.ts](../../app/(authenticated)/admin/infrastructure/MySQLUserRepository.ts): drop `role` from `COLUMNS`/INSERT/UPDATE and `UserRow`; implement `getRoleIds`/`setRoles`. `User` domain entity drops `role`.
- [CreateUserUseCase.ts](../../app/(authenticated)/admin/application/CreateUserUseCase.ts) / [UpdateUserUseCase.ts](../../app/(authenticated)/admin/application/UpdateUserUseCase.ts): accept `roleIds: number[]`; drop the `role` enum validation; after create/update call `setRoles`. Update `SetUserRolesUseCase` guard (protected pin) applies in Update too.
- [GetUsersUseCase.ts](../../app/(authenticated)/admin/application/GetUsersUseCase.ts) / `UserListItem`: replace `role` with `roleIds: number[]` + `roleNames: string[]` (batch-resolve names).
- [users/route.ts](../../app/(authenticated)/admin/api/users/route.ts) + [users/[id]/route.ts](../../app/(authenticated)/admin/api/users/[id]/route.ts): parse `roleIds`; swap the inline `role !== "admin"` guard for `requirePermission("admin.users")`.

### 10. Admin UI
- **RolesTab.tsx** (mirror [UsersTab.tsx](../../app/(authenticated)/admin/UsersTab.tsx)): card list (search by name; disabled muted; Administrator "Protected" badge; member count + permission summary) → slide-up `Sheet` with name/description/active toggle + grouped permission checkboxes (from `GET /admin/api/permissions`) + a members section (searchable add/remove via `GET/PUT .../members`). Administrator sheet is read-only except members; protected account locked in Administrator. Toggling a sensitive permission (`isSensitivePermission`) prompts the reused `ConfirmDialog` before staging. Delete blocked with member-count message. Persistent "Changes apply at next sign-in" notice.
- [page.tsx](../../app/(authenticated)/admin/page.tsx): add `<TabsTrigger value="roles">Roles</TabsTrigger>` + content `<RolesTab />`; on mount `getSession()` → filter which `TabsTrigger`/`TabsContent` render by the caller's `admin.*` permissions (default the active tab to the first permitted one).
- [UsersTab.tsx](../../app/(authenticated)/admin/UsersTab.tsx): replace the single-select role buttons + `RoleBadge`/`ROLE_LABEL` with a **checkbox list of roles** (`GET /admin/api/roles`); card shows joined `roleNames`. Confirm dialog fires when the staged set adds Administrator or any sensitive-permission role (compute from the role's permissions). Send `roleIds` in POST/PUT. Protected account's Administrator checkbox locked.

### 11. Home launcher (FR-17)
- [(authenticated)/page.tsx](../../app/(authenticated)/page.tsx): derive `permissions` from `session.user.permissions`. Give each `ModuleCard` a `permission` key; render a card only if held (Admin card → `hasAnyAdminTabPermission`; History → `module.history`). If no module/admin cards qualify, render the "No modules assigned — contact an administrator" empty state. Drop `adminOnly`/`UserRole`.

### 12. Header role display
- [(authenticated)/layout.tsx](../../app/(authenticated)/layout.tsx) & [(setup)/layout.tsx](../../app/(setup)/layout.tsx): pass `roleNames={session.user.roleNames}` to `AppHeader`; setup gate uses `hasAnyAdminTabPermission(session.user.permissions)` in place of `role === "admin"`.
- [AppHeader.tsx](../../app/shared/ui/AppHeader.tsx) / [AccountMenu.tsx](../../app/shared/ui/AccountMenu.tsx): prop `roleNames: string[]`; show comma-joined names (or "No roles"); delete `ROLE_LABEL`/`UserRole`.

### 13. Delivery — remove step-up, rework gate (FR-19, FR-20, FR-22)
- **Delete** the files listed under *Affected Areas → Delivery*.
- `domain/Delivery.ts`: remove approval-proof/`FlaggedLine`-token types; keep `DiscrepancyApprovalRequiredError`, `ReceiverNotLinkedError`, `PurchaseOrderAlreadyReceivedError`.
- `CommitDeliveryUseCase`: input gains `canAdjustLines?` / `canApproveDiscrepancies: boolean` (from the route), drops the `approval` proof object. When blind mode (from settings) yields Over/Not-Ordered lines and `!canApproveDiscrepancies` → throw `DiscrepancyApprovalRequiredError`. When approved, persist `discrepancy_approved=1`, `approved_by_user_id`/`approver_name` = **committer**, `approved_at`. Return-Excess events unchanged (data), just no proof.
- [api/route.ts](../../app/(authenticated)/delivery/api/route.ts): drop all `approval`/`ApprovalBody` parsing; read `session.user.permissions`; pass `canApproveDiscrepancies = perms.includes("delivery.approve_discrepancies")`. Add `capabilities: { canAdjustLines, canApproveDiscrepancies }` to the PO-for-receiving `GET` (and PO-list) responses.
- `page.tsx`: delete the admin-password modal + `verify-admin`/`admin-unlock`/`approve` fetches (lines ~1229/1296/1362) and the persisted approval token in `localStorage`; drive line edit/delete off `capabilities.canAdjustLines` and the blind-discrepancy unlock off `capabilities.canApproveDiscrepancies` (controls hidden/disabled when absent, no prompt). Save stays blocked in blind mode until a holder acts; server re-checks.

### 14. Counting — remove step-up (FR-21)
- [api/route.ts](../../app/(authenticated)/counting/api/route.ts): add `canAdjustLines = perms.includes("counting.adjust_lines")` to the `GET` gate payload alongside `canSave`.
- `page.tsx`: remove the admin-auth component (~line 622) that POSTs to `/delivery/api/verify-admin`; gate edit-qty/delete-line off `canAdjustLines`.

### 15. Setup API gates
- `setup/api/{advance,finish,reset}/route.ts`: `role !== "admin"` → `!hasAnyAdminTabPermission(session.user.permissions)` (403).

### 16. Cleanup pass
- Grep-remove remaining `UserRole` / `session.user.role` references so the build (lint) is clean. Confirm no dangling imports of deleted delivery files in `container.ts` / routes.

## Risks & Open Questions
- **Generic adjust/delete is not independently server-verifiable at commit.** Both delivery and counting commits carry only *final* quantities — no per-line "adjusted" signal and no server-side scan history — so `delivery.adjust_lines` / `counting.adjust_lines` remain effectively **UI gates**. The genuinely server-enforced delivery gate is the Over/Not-Ordered **discrepancy approval** (step 13), which the server re-derives from the PO every commit. FR-18/FR-19's "server rejects the mutation" is honored for the discrepancy path; the plan does **not** invent a new adjust-signal payload (YAGNI, PRD specifies no mechanism). Flag for the implementer if stricter enforcement is later required.
- **`resolveUserPermissions` adds one DB round-trip at sign-in** (three-table join). Cheap and only on login; acceptable.
- **Protected-account pin** must be enforced in *both* directions (role members PUT and user roles PUT) and for the Administrator role's immutability — verify the 403s with a direct-API test, since the UI hides the controls.
- **`getSession()` on the client** must return `permissions`/`roleNames` — verify the session callback exposes them (they're set in step 4) before wiring tab visibility.
- **Existing sessions after deploy** keep the old token shape (no `permissions`) until next login; middleware/layouts must treat a missing `permissions` as empty (deny) so no stale-token bypass — confirm `req.auth.user.permissions ?? []` guards everywhere.
- **Delivery `page.tsx` is large** and the approval-token removal touches persisted `localStorage` state; regress-test the blind-mode receive → review → save flow end-to-end after the rework.
