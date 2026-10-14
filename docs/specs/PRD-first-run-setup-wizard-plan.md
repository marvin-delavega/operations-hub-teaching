# Implementation Plan: First-Run Setup Wizard
Source PRD: [PRD-first-run-setup-wizard.md](PRD-first-run-setup-wizard.md)
Date: 2026-07-01

## Summary
Add a one-time, installation-level setup wizard at `/setup` that walks an admin through four linear steps (General → Users → Location visibility → Delivery), each embedding the **same** component the matching `/admin` tab uses. Completion is a global server-side flag in `app_settings` (`setup_completed`), read through a cached helper and enforced in the **authenticated server layout** (not edge middleware): while incomplete, admins are redirected into the wizard and staff see a soft wall (header/account-menu/sign-out preserved). A guarded, **non-destructive** Reset in the `/admin` General tab re-arms the wizard. No new tables — all state lives in `app_settings`.

## Affected Areas

**New module — `setup` (its own route group, deliberately outside `(authenticated)` so the gate can't loop):**
- `app/(setup)/layout.tsx` — server layout: renders `AppHeader` (session + company name), metadata `{ title: "Setup" }`, and guards the route (completed → redirect `/`; staff → soft wall).
- `app/(setup)/setup/page.tsx` — `"use client"` four-step wizard (route `/setup`).
- `app/(setup)/setup/domain/SetupState.ts` — `SetupStatus` type + `SetupStateRepository` port.
- `app/(setup)/setup/application/GetSetupStatusUseCase.ts`, `AdvanceSetupProgressUseCase.ts`, `FinishSetupUseCase.ts`, `ResetSetupUseCase.ts`.
- `app/(setup)/setup/infrastructure/MySQLSetupStateRepository.ts` — reads/writes `app_settings` keys.
- `app/(setup)/setup/api/status/route.ts` (GET), `advance/route.ts` (POST), `finish/route.ts` (POST), `reset/route.ts` (POST) — routes `/setup/api/status|advance|finish|reset`.

**Shared code added:**
- `app/shared/infrastructure/getSetupStatus.ts` — `unstable_cache` helper (mirrors [getCompanyName.ts](../../app/shared/infrastructure/getCompanyName.ts)), tag `setup-status`.
- `app/shared/ui/SetupSoftWall.tsx` — "Setup in progress — contact your admin" card, used by both the authenticated layout (staff) and setup layout (staff).

**Existing files changed:**
- `app/(authenticated)/layout.tsx` — add the setup gate (redirect admins / soft-wall staff).
- `app/(authenticated)/admin/page.tsx` — replace three inline blocks with the extracted components below; add a **Reset setup** danger section to the General tab.
- `container.ts` — add four setup factories.
- `scripts/seed-app-bootstrap.sql` — leave `setup_completed` unseeded (documented), so the wizard triggers on a fresh install.

**Components extracted from `admin/page.tsx` (reused by admin + wizard — satisfies FR-6/DRY):**
- `app/(authenticated)/admin/CompanyNameCard.tsx` — company-name field + Save (PUT `/admin/api/settings` `{ company_name }`). Exposes `onSaved(name)` so the wizard can gate "Next" on a non-empty saved name.
- `app/(authenticated)/admin/LocationVisibilityManager.tsx` — the location-visibility Card/table/toggle logic.
- `app/(authenticated)/admin/DeliverySettingsCard.tsx` — the delivery toggles Card.
- `app/(authenticated)/admin/UsersTab.tsx` — already standalone; reused as-is in step 2.

**DB tables/columns:**
- Our own `app_settings` (key-value, unchanged schema): keys `setup_completed`, `setup_progress_step`, `setup_completed_at`, `setup_completed_by`, `setup_reset_at`, `setup_reset_by` (+ existing `company_name`, `delivery_continuous_scanning`, `delivery_blind_delivery`).
- Our own `module_location_visibility` (via existing `SetLocationVisibilityUseCase`), `users` (via existing Users endpoints). **No `create-app-tables.sql` change** — keys are dynamic.

**container.ts factories added:** `createGetSetupStatusUseCase`, `createAdvanceSetupProgressUseCase`, `createFinishSetupUseCase`, `createResetSetupUseCase`.

## Decisions

- **Resolved by AI:** `/setup` lives in its own route group `app/(setup)/`, not under `(authenticated)`. — The gate redirects admins to `/setup`; keeping it outside the gated group makes the redirect-loop exemption (FR/§9) structural, needs no pathname sniffing or middleware change, and mirrors how `/login` lives in `(auth)` outside `(authenticated)`.
- **Resolved by AI:** Gate enforced in `app/(authenticated)/layout.tsx` via a cached `getSetupStatus()`. — PRD FR-2/FR-4 and §9 mandate server-layout enforcement (mysql2 not edge-safe); mirrors the existing `getCompanyName()` `unstable_cache`/`revalidateTag("app-settings")` pattern with a new `setup-status` tag.
- **Resolved by AI:** New `setup` module with a dedicated `SetupStateRepository` writing `app_settings` directly, rather than importing admin's `AppSettingsRepository`. — Keeps the module self-contained (SRP), avoids a cross-module domain-port dependency; repository still uses the same `app_settings` INSERT…ON DUPLICATE KEY pattern as [MySQLAppSettingsRepository.ts](../../app/(authenticated)/admin/infrastructure/MySQLAppSettingsRepository.ts).
- **Resolved by AI:** Reset password re-verification reuses the existing `VerifyAdminUseCase`/`MySQLAdminVerifier` (via `createVerifyAdminUseCase()`) rather than a new verifier. — It already "verifies any active admin's credentials" (active + role=admin + bcrypt); wiring cross-module use cases is exactly what `container.ts` is for.
- **Resolved by AI:** Extract company-name / location-visibility / delivery-toggle blocks out of `admin/page.tsx` into standalone components. — FR-6 ("embed the same component") + DRY; admin's General "Save" currently bundles company name with the scan-batch delay, so company name gets its own card/save (both keep hitting `/admin/api/settings`).
- **Resolved by AI:** Wizard slide reuses the login widget's transform technique. — `translateX(-25% * step)` on a `width:400%` flex track, `motion-safe:transition-transform duration-300`, matching [login/page.tsx](../../app/(auth)/login/page.tsx) `PANEL_TRANSFORM`; semantic tokens only.
- **Resolved by AI:** Per-step data commit rides the embedded components' existing endpoints. — Users CRUD, visibility toggles, and delivery toggles already save on interaction; General saves company name on "Next"; the wizard additionally POSTs `/setup/api/advance` to move the global progress marker.
- **Assumptions:** `setup_completed` is intentionally **not** seeded, so a fresh install (even with `company_name` seeded) runs the wizard. `setup_progress_step` stored as a string `"1"`–`"4"`; timestamps written in Asia/Manila (FR-18/§6). No `AskUserQuestion` was needed — the PRD lists no outstanding open questions and every fork is resolvable from CLAUDE.md/existing patterns.

## Implementation Steps

Order follows clean-architecture layering; the admin-component extraction (Step 7) is a prerequisite for the wizard page (Step 8) but is independent of the setup backend (Steps 1–6), so it can proceed in parallel.

### 1. Domain — setup state port
- Create [app/(setup)/setup/domain/SetupState.ts](../../app/(setup)/setup/domain/SetupState.ts):
  - `interface SetupStatus { completed: boolean; currentStep: number }`.
  - `interface SetupStateRepository { getStatus(): Promise<SetupStatus>; setProgress(step: number): Promise<void>; markCompleted(by: string, at: Date): Promise<void>; markReset(by: string, at: Date): Promise<void> }`.
- Layer rule: no imports from application/infrastructure.

### 2. Application — setup use cases
- `GetSetupStatusUseCase.execute(): Promise<SetupStatus>` → `repo.getStatus()`.
- `AdvanceSetupProgressUseCase.execute(step: number)` → validate `1 ≤ step ≤ 4`, write **max(current, step)** (fetch current, keep furthest) via `repo.setProgress`.
- `FinishSetupUseCase.execute(byUsername: string)` → `repo.markCompleted(byUsername, now)` (sets `setup_completed='true'`, `setup_completed_at`, `setup_completed_by`).
- `ResetSetupUseCase` — constructor takes `SetupStateRepository` **and** `AdminVerifier` (reuse existing port); `execute(username, password)` → `if (!await verifier.verify(username, password)) throw`; else `repo.markReset(username, now)` (sets `setup_completed='false'`, resets `setup_progress_step='1'`, writes `setup_reset_at`/`setup_reset_by`). Mirror the throw-on-bad-password shape of [ChangeOwnPasswordUseCase.ts](../../app/(authenticated)/account/application/ChangeOwnPasswordUseCase.ts) (`IncorrectPasswordError`).
- Application imports domain only.

### 3. Infrastructure — MySQLSetupStateRepository
- Create [app/(setup)/setup/infrastructure/MySQLSetupStateRepository.ts](../../app/(setup)/setup/infrastructure/MySQLSetupStateRepository.ts) using `pool` from [db.ts](../../app/shared/infrastructure/db.ts) and the same `INSERT … ON DUPLICATE KEY UPDATE` upsert as [MySQLAppSettingsRepository.ts](../../app/(authenticated)/admin/infrastructure/MySQLAppSettingsRepository.ts).
  - `getStatus`: single `SELECT key,value FROM app_settings WHERE key IN ('setup_completed','setup_progress_step')`; `completed = value==='true'`, `currentStep = clamp(Number(setup_progress_step) || 1, 1, 4)`.
  - `setProgress`, `markCompleted`, `markReset`: upserts. Timestamps formatted Asia/Manila.

### 4. container.ts — factories
- Add imports + `createGetSetupStatusUseCase()`, `createAdvanceSetupProgressUseCase()`, `createFinishSetupUseCase()`, `createResetSetupUseCase()` (the last wires `new MySQLSetupStateRepository()` **and** `new MySQLAdminVerifier()`). Follow the existing factory style (see the `createGetAppSettingUseCase` block).

### 5. Shared — cached status reader + soft wall
- [app/shared/infrastructure/getSetupStatus.ts](../../app/shared/infrastructure/getSetupStatus.ts): `unstable_cache(async () => createGetSetupStatusUseCase().execute(), ["setup-status"], { tags: ["setup-status"] })`, with a try/catch defaulting to `{ completed: true, currentStep: 1 }` on error (**fail-open** so a DB blip can't lock everyone out of the app). Mirrors [getCompanyName.ts](../../app/shared/infrastructure/getCompanyName.ts).
- [app/shared/ui/SetupSoftWall.tsx](../../app/shared/ui/SetupSoftWall.tsx): server-safe presentational `Card` — heading "Setup in progress", body "An administrator is finishing first-time setup. Please check back shortly." Semantic tokens only.

### 6. API — setup lifecycle routes
- `GET /setup/api/status` → `{ completed, currentStep }` from `createGetSetupStatusUseCase()`. Session required (admin) — read use case, no writes (CQS).
- `POST /setup/api/advance` `{ step }` → `requireAdmin` (403 else); `createAdvanceSetupProgressUseCase().execute(step)`; `{ ok: true }`.
- `POST /setup/api/finish` → `requireAdmin`; `createFinishSetupUseCase().execute(session.user.name/username)`; `revalidateTag("setup-status")`; `{ ok: true }`.
- `POST /setup/api/reset` `{ password }` → `requireAdmin`; `createResetSetupUseCase().execute(session.user.name/username, password)`; on `IncorrectPasswordError` → `403`; on success `revalidateTag("setup-status")` → `{ ok: true }`.
- Use the inline `auth()` + `role !== "admin"` guard pattern from [admin/api/route.ts](../../app/(authenticated)/admin/api/route.ts). Confirm which session field holds the ActiveOne/username used for `MySQLAdminVerifier` (username, not display name) — the verifier queries `users.username`, so pass `session.user`'s username.

### 7. Extract reusable admin components (refactor `admin/page.tsx`)
- **CompanyNameCard.tsx** — company-name `Input` + Save button + message; PUT `/admin/api/settings` `{ company_name }`; props `{ onSaved?: (name: string) => void }`. Move the company-name portion out of `saveAppSettings`; the scan-batch-delay field + item-cache section stay inline in the admin General tab (keep their own Save).
- **LocationVisibilityManager.tsx** — move the `locationsByModule` state, fetch, `toggleVisibility`, and the Card/table JSX (lines ~383–439 of current `admin/page.tsx`).
- **DeliverySettingsCard.tsx** — move the delivery-toggle Card + `toggleDeliverySetting` + `continuousScanning`/`blindDelivery` state (Delivery tab block).
- Re-point `admin/page.tsx` General tab to `<CompanyNameCard/>` + `<LocationVisibilityManager/>` and Delivery tab to `<DeliverySettingsCard/>`. Verify no lint regressions (semantic tokens, `motion-safe:` — enforced by [eslint.config.mjs](../../eslint.config.mjs)).

### 8. Setup layout + wizard page
- [app/(setup)/layout.tsx](../../app/(setup)/layout.tsx) (server): `const [session, companyName, status] = await Promise.all([auth(), getCompanyName(), getSetupStatus()])`. Render `<AppHeader companyName name role/>` always. Then: if `status.completed` → `redirect("/")`; if `role !== "admin"` → render `<SetupSoftWall/>`; else render `{children}`. `export const metadata = { title: "Setup" }` (root template yields `{Company} · Ops Hub · Setup`, matching [admin/layout.tsx](../../app/(authenticated)/admin/layout.tsx)).
- [app/(setup)/setup/page.tsx](../../app/(setup)/setup/page.tsx) (`"use client"`):
  - On mount `GET /setup/api/status` → set `step` to `currentStep` (resume, FR-10).
  - Four-panel slide track (`width:400%`, `translateX(-25%*(step-1))`, `motion-safe:transition-transform duration-300`) mirroring login's `PANEL_TRANSFORM`. "Step X of 4" indicator.
  - **Step 1 General:** `<CompanyNameCard onSaved={…}/>`; "Next" disabled until a non-empty company name is saved (FR-7); Next → ensure save → `POST /setup/api/advance {step:2}` → slide.
  - **Step 2 Users:** `<UsersTab/>`; "Skip for now" / "Back" / "Next" → advance(3).
  - **Step 3 Location visibility:** `<LocationVisibilityManager/>`; Skip/Back/Next → advance(4).
  - **Step 4 Delivery:** `<DeliverySettingsCard/>`; "Back" / "Finish" → `POST /setup/api/finish` → success/summary screen (FR-13) → button `router.push("/")`.
  - Skip actions still call `advance` to move the marker; Back re-opens prior steps (their embedded components already re-save on change).

### 9. Authenticated layout gate
- Edit [app/(authenticated)/layout.tsx](../../app/(authenticated)/layout.tsx): add `getSetupStatus()` to the `Promise.all`. After resolving `role`:
  - if `!status.completed && role === "admin"` → `redirect("/setup")` (before rendering children; header not needed since we leave immediately).
  - if `!status.completed && role !== "admin"` → render `<AppHeader/>` + `<SessionGuard/>` + `<SetupSoftWall/>` **instead of** `{children}` (FR-3: header/account-menu/sign-out retained).
  - else render as today.
- No middleware change (§9: edge can't read the DB flag).

### 10. Admin General tab — Reset setup
- In `admin/page.tsx` General tab, add a danger-styled section (`variant="destructive"` Button) opening a shared `Dialog` (FR-14/16): consequence copy ("This will re-run first-time setup for all admins and temporarily block staff until finished") + `PasswordInput` for the acting admin's password.
- Confirm → `POST /setup/api/reset { password }`. On 403 → inline error; on success → close dialog, toast "Setup re-armed" (the admin will be redirected to `/setup` on next navigation once the cache is invalidated). Reuse [ChangePasswordDialog.tsx](../../app/shared/ui/ChangePasswordDialog.tsx) / [PasswordInput.tsx](../../app/shared/ui/PasswordInput.tsx) styling.

### 11. Seed / docs
- Confirm [seed-app-bootstrap.sql](../../scripts/seed-app-bootstrap.sql) does **not** insert `setup_completed`; add a comment noting its intentional absence so fresh installs run the wizard.

## Risks & Open Questions
- **Redirect-loop safety:** `/setup` must never be wrapped by `(authenticated)/layout.tsx`. Placing it in the `(setup)` group guarantees this structurally — verify no accidental nesting and that middleware still requires a session for `/setup` (it does: only `/login` + `/api/auth` are public).
- **Fail-open vs fail-closed:** `getSetupStatus()` defaults to `completed:true` on DB error so an outage can't wall the whole app. Confirm this is the desired trade-off (a transient DB error would skip the gate rather than block everyone).
- **Session username field:** `MySQLAdminVerifier` matches on `users.username`; ensure the setup reset/finish endpoints pass the session's **username**, not display `name`. Verify what the JWT/session exposes before wiring.
- **Admin General "Save" split:** extracting company name into its own card changes the current single-Save behavior (company name + scan delay saved together). Confirm the two independent saves are acceptable UX.
- **Concurrent admins:** last-write-wins on shared keys + "furthest step" marker is per PRD §9; `AdvanceSetupProgressUseCase` reads-then-writes max — a race could momentarily lower the marker, but the next advance corrects it (acceptable, non-destructive).
- **Cache tag scope:** `setup-status` is a separate tag from `app-settings`, so company-name saves during the wizard don't needlessly invalidate the gate; only finish/reset call `revalidateTag("setup-status")`. Verify `revalidateTag` in a route handler propagates before the admin's next navigation (same mechanism the settings PUT already relies on).
