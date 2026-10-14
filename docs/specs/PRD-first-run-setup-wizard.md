# PRD: First-Run Setup Wizard
Date: 2026-07-01

## 1. Overview
A one-time, installation-level setup wizard that runs the first time Operations Hub is used on **any** device. On a fresh install, admins are guided through a linear, four-step wizard that mirrors the `/admin` configuration tabs (Welcome + General, Users, Location visibility, Delivery), configuring the settings needed for the app to function. Completion is tracked by a single global server-side flag so it runs **once per installation**, not once per device. A guarded, non-destructive **Reset** in the `/admin` General tab re-arms the wizard to run again.

## 2. Goals
- Ensure a fresh install cannot be used until an admin has walked through core configuration (or explicitly skipped optional steps).
- Track setup completion **globally** (server-side), so the wizard never re-triggers per device.
- Reuse existing `/admin` tab UI so the wizard and `/admin` stay consistent (DRY).
- Persist each step as it is completed (per-step commit) so no work is lost on abandonment.
- Provide a safe, non-destructive way to re-run setup (Reset) without wiping real data.
- Keep staff unblocked from signing out while the app is being set up.

## 3. Non-Goals
- **No** per-device or per-user setup state — setup is one shared installation-level task.
- **No** destructive reset — Reset never wipes settings, deletes users, or clears configuration.
- **No** operational tabs in the wizard — Order Scheduling, Order Pooling, and the Sales rollup health panel are configured later via normal `/admin` use, not the wizard.
- **No** speculative general settings — only `company_name` in the General step; no default-location/date-format settings introduced by this feature.
- **No** free-jump navigation — the wizard is strictly linear (Back/Next).
- **No** full audit log — only lightweight completed_at / completed_by / last-reset markers.
- **No** middleware DB access — the redirect gate is enforced in the server layout, not edge middleware.

## 4. Users & Roles
- **Admin** (incl. the shipped protected admin): forced into the wizard while setup is incomplete; the only role that can run or complete setup; the only role that can trigger Reset.
- **Staff**: soft-walled while setup is incomplete — all modules blocked, but the shared header, account menu, and sign-out remain available. Cannot access or run the wizard.
- Completion and progress are **global** — any admin can advance the shared setup; the last write wins per field; once any admin clicks Finish, setup is complete for everyone.

## 5. Functional Requirements

**Trigger & completion state**
- FR-1: Setup completion is stored as a **global flag** in `app_settings` (`setup_completed`). Absent/false = setup not done; true = done.
- FR-2: While `setup_completed` is false, admins are redirected to `/setup` on any authenticated navigation (except `/setup` itself and the account-menu/sign-out surfaces).
- FR-3: While `setup_completed` is false, staff are shown the soft wall on any protected route; they retain header, account menu, and sign-out.
- FR-4: The completion flag is read from a **server-cached** value; the cache is explicitly invalidated on Finish and on Reset so the gate reacts on the next navigation for all users.

**Wizard steps & order**
- FR-5: The wizard has exactly four linear steps, in order: (1) **Welcome + General** (company name), (2) **Users**, (3) **Location visibility**, (4) **Delivery** toggles.
- FR-6: Each step **embeds the same component** used by the corresponding `/admin` tab (refactored to be embeddable outside its tab if needed).
- FR-7: **Company name is required** — the admin cannot advance past the General step until a non-empty company name is saved.
- FR-8: The Users, Location visibility, and Delivery steps are **skippable** via an explicit **"Skip for now"** action indicating they can be configured later in `/admin`.

**Persistence, navigation, resume**
- FR-9: Each step **commits its data immediately** on advance (per-step commit), writing to the same tables the normal `/admin` tabs write to (`app_settings`, `users`, `module_location_visibility`, delivery toggle keys).
- FR-10: A **global progress marker** records the furthest step reached. On re-entry after abandonment, the wizard resumes at the **last step reached**.
- FR-11: Navigation is strictly **linear**: Back and Next only, with a visible **"Step X of 4"** progress indicator. Back re-opens a previous step for editing; edits re-save on advance.
- FR-12: Step transitions use the design-system **linear slide** pattern (matching the login/fast-login wizard), gated behind `prefers-reduced-motion` (cross-fade/cut fallback). Semantic tokens only.

**Finish**
- FR-13: On the final step, **Finish** sets `setup_completed = true`, records completion audit markers, invalidates the cached flag, and shows a **success/summary screen** ("Setup complete — here's what you configured") with a button that lands the admin on **`/`** (module launcher).

**Reset**
- FR-14: The `/admin` **General tab** contains a **Reset setup** action (distinct/danger-styled).
- FR-15: Reset is **non-destructive** — it only re-arms setup (sets `setup_completed = false` and resets the progress marker). All existing settings, users, and configuration are preserved and **pre-fill** the wizard on the next run.
- FR-16: Reset requires a **confirmation dialog** that spells out the consequence ("This will re-run first-time setup for all admins and temporarily block staff until finished") **and** re-entry of the acting admin's **password** before it proceeds.
- FR-17: On confirmed Reset, the cached flag is invalidated so all admins are redirected into the wizard and staff are soft-walled on their next navigation.

**Audit**
- FR-18: Store lightweight installation-level markers in `app_settings`: `setup_completed_at`, `setup_completed_by`, and the actor/time of the last Reset.

**Titles**
- FR-19: `/setup` pages follow the standard title convention `{Company Name} · Ops Hub · Setup`, falling back to `Operations Hub` before company name is saved.

## 6. Data Model
No new tables. All state lives in the existing key-value `app_settings` table (see CLAUDE.md — "Add settings as needed, no schema change").

| Key | Type (stored as string) | Meaning |
|---|---|---|
| `setup_completed` | boolean | Global completion flag. Absent/false ⇒ wizard runs. |
| `setup_progress_step` | integer (1–4) | Global furthest step reached; drives resume. |
| `setup_completed_at` | datetime (Asia/Manila) | When setup was last completed. |
| `setup_completed_by` | string (username / user id) | Which admin completed setup. |
| `setup_reset_at` | datetime (Asia/Manila) | When setup was last reset. |
| `setup_reset_by` | string (username / user id) | Which admin reset setup. |

Existing keys/tables written **by the wizard steps** (unchanged schema, reusing existing write paths):
- `company_name` (`app_settings`) — General step.
- `users` table — Users step (create/edit; soft-deactivate only; never hard-delete).
- `module_location_visibility` — Location visibility step.
- Delivery toggle keys (`delivery_continuous_scanning`, `delivery_blind_delivery`) — Delivery step.

## 7. API Contract
Reuses the existing per-tab `/admin`-area endpoints for the actual settings writes (company name, users, visibility, delivery toggles) — the wizard is a new client surface over the same use cases, not new business logic. New endpoints are limited to setup lifecycle:

- **GET setup status**
  - Purpose: read `setup_completed` + `setup_progress_step` for the gate and resume.
  - Response: `{ completed: boolean, currentStep: number }`.
  - Server-cached; used by the authenticated server layout.

- **POST advance progress**
  - Purpose: record the furthest step reached (per-step commit of the marker; the step's actual data is written via that tab's existing endpoint).
  - Request: `{ step: number }`.
  - Response: minimal confirmation.

- **POST finish setup**
  - Purpose: set `setup_completed = true`, write `setup_completed_at` / `setup_completed_by`, invalidate cache.
  - Response: minimal confirmation.

- **POST reset setup**
  - Purpose: re-arm the wizard (non-destructive).
  - Request: `{ password: string }` (acting admin's password, re-verified server-side).
  - Behavior: set `setup_completed = false`, reset `setup_progress_step`, write `setup_reset_at` / `setup_reset_by`, invalidate cache.
  - Response: minimal confirmation on success; `403`/error on bad password.

Command-Query Separation: the status read is GET and changes nothing; advance/finish/reset are POST and return minimal confirmations.

## 8. UI/UX Flow

**Fresh install — admin path**
1. Admin signs in (shipped protected admin works out of the box).
2. Authenticated server layout reads the cached flag → false → redirect to `/setup`, resuming at the stored step (Step 1 on first run).
3. **Step 1 — Welcome + General:** brief welcome copy + company-name field (embedded General component). "Next" disabled until company name is non-empty. Advancing saves company name and moves the progress marker to step 2.
4. **Step 2 — Users:** embedded Users tab UI to create real admin/staff accounts. "Skip for now" or "Next" (saving via the Users endpoints). "Back" returns to Step 1.
5. **Step 3 — Location visibility:** embedded visibility UI. Skip/Next/Back.
6. **Step 4 — Delivery:** embedded delivery-toggles UI. Skip/Finish/Back.
7. **Finish:** flag flips true, cache invalidated, audit markers written → **success/summary screen** listing what was configured → button → lands on `/`.
8. Transitions between steps slide linearly with a "Step X of 4" indicator; reduced-motion users get cross-fade/cut.

**Fresh install — staff path**
1. Staff signs in while setup incomplete.
2. Any protected route → **soft wall** ("Setup in progress — contact your admin"); shared header/account menu/sign-out remain usable.
3. Once an admin finishes, staff navigate normally on next request (cache invalidated).

**Resume after abandonment**
1. Admin closes the browser mid-wizard (e.g. after Step 2).
2. On next sign-in, layout redirects to `/setup`, which opens at the **last step reached** (Step 2) with earlier values already saved/pre-filled.

**Reset (live install)**
1. Admin opens `/admin` → General tab → **Reset setup**.
2. Confirmation dialog explains the consequence; admin re-enters password.
3. On confirm, flag re-armed + cache invalidated: all admins are redirected to `/setup` and staff soft-walled on next navigation. Wizard pre-fills all existing values.

## 9. Edge Cases & Error Handling
- **New device after completion:** flag is global and true → no wizard; app behaves normally. (Core requirement.)
- **`/setup` accessed after completion:** flag true → redirect to `/` (no wizard shown).
- **Staff reaching `/setup`:** shown the soft wall; the route is not an admin escape hatch.
- **Redirect loop:** `/setup` is exempt from the "redirect to `/setup`" gate; the account-menu/sign-out surfaces are exempt from the staff wall.
- **Concurrent admins:** both edit the same shared tables; last-write-wins per field (identical to normal `/admin`); the global progress marker advances to the furthest step; once anyone clicks Finish, setup is complete for all.
- **Company name left blank:** cannot advance past General (required-field gate).
- **Reset with wrong password:** rejected server-side (`403`/error), flag unchanged.
- **Reset on a live system:** confirmation dialog explicitly warns that all admins are re-entered into setup and staff are temporarily walled.
- **Stale cached flag:** avoided by explicit cache invalidation on Finish and Reset.
- **Edge middleware limitation:** middleware cannot read the DB flag (mysql2 not edge-compatible); enforcement lives in the authenticated server layout instead.
- **Shipped protected admin during Users step:** remains fully locked (no edit/reset/deactivate) per existing Users-tab rules; creating additional accounts is the normal path.

## 10. Open Questions
- None outstanding. (Cache mechanism, invalidation triggers, and gate location are decided; remaining specifics are implementation detail.)

## 11. Out of Scope / Deferred
- Operational tabs in the wizard (Order Scheduling, Order Pooling, Sales rollup health) — configured via normal `/admin`.
- Additional general settings (default location, date format) — slot into the General step later, no schema change.
- Full audit log of setup actions — only lightweight completed/reset markers now.
- Destructive reset (wipe settings/data) — explicitly rejected.
- Per-user or per-device setup checklists — setup is a single global task.
- Free-jump step navigation / branching wizards.
