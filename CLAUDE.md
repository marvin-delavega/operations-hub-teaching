# CLAUDE.md

Guidance for Claude Code working in this repo.

## Commands

```bash
npm run dev       # dev server (Turbopack)
npm run build     # production build (Turbopack)
npm run start     # serve production build
npm run lint      # ESLint
npm test          # Vitest (single run)
npm run test:watch # Vitest (watch)
```

Unit tests use **Vitest** (`vitest.config.ts`); tests live under `tests/`, mirroring `src/`, and import source via the `@/*` alias. Current coverage is **pure logic only** — no DB, no Next.js runtime (e.g. RBAC path/permission checks, manufacturer-token encoding, shelf-guide weighting, DB-config coercion). Test files are type-checked by `tsc` alongside the app.

**Build verification — READ THIS.** `npm run build` (`next build --turbopack`) **hangs in the local Windows dev environment**: it stalls at the pre-compilation bootstrap step (right after printing `- Environments: .env.local`, before "Creating an optimized production build"), blocked on I/O with ~0 CPU and no `.next` writes. `npx next build` (webpack) hangs **identically**, so it is **not** a Turbopack bug, and it is **not the code** — ruled out: custom webpack config (empty), Tailwind scan (v4), and `next/font/google` fetch (Node fetches the Geist CSS in ~350 ms). Root cause is environmental (most likely Windows Defender/AV real-time scanning of `.next`/`node_modules` during the build, or a corrupted cache). `npm run dev` is unaffected. **Until the machine issue is fixed, verify changes with `npx tsc --noEmit` + `npm run lint`** (both authoritative and fast) rather than waiting on `next build`. Do **not** re-diagnose the feature code when `build` hangs at bootstrap — it's the environment.

## Tooling

**Serena MCP** (`.mcp.json`, project scope) gives language-server symbol tools — `get_symbols_overview`, `find_symbol`, `find_referencing_symbols`, etc. **Prefer these over reading whole files**: read a symbol/outline, not a whole file. Runs via `uvx --from serena-agent`. Plain `Read`/`Grep` fine for small/non-code files.

### Agentic Flow

Substantive work runs through a **gated pipeline**: brainstorm → plan → recommend → implement → commit, with a decision gate (`AskUserQuestion`) at every boundary. A `UserPromptSubmit` hook offers it automatically on each new topic; [/flow](.claude/commands/flow.md) `<topic>` is the manual entry point. **Model routing:** *brainstorm* + *plan* + the *recommendation round* run in the main loop on **Opus** (the *think* tier); *implement* + *commit* are dispatched to the [implementer](.claude/agents/implementer.md) / [committer](.claude/agents/committer.md) subagents on **Sonnet** (the *do* tier) — so resolve implementation forks with the developer *before* dispatch, since subagents can't ask. Protocol text: [.claude/hooks/flow-protocol.md](.claude/hooks/flow-protocol.md). Config (hook + model/effort) lives in `.claude/settings.local.json` (personal, gitignored).

## Environment Setup

`.env.local`:

```
DB_HOST=                # DB_* optional — seed/fallback only (see below)
DB_PORT=3306
DB_USER=
DB_PASSWORD=
DB_NAME=
AUTH_SECRET=            # generate with: npx auth secret
ROLLUP_REFRESH_TOKEN=   # shared secret for the nightly rollup POST endpoint
```

`NEXTAUTH_URL` (required by Auth.js) also serves as the base URL in the rollup scheduled-task curl command — no separate `APP_BASE_URL`.

### ActiveOne DB connection (configured from the UI)

One MySQL connection powers both ActiveOne data and every app-owned table, configured **from the UI**, not primarily env. Resolution: **`data/db-config.json`** (UI-saved, gitignored, plaintext — same trust as `.env.local`) → **`DB_*` env** (seed/fallback for first boot + backfill CLI). Resolved in `src/shared/infrastructure/dbConfig.ts`; the pool in `db.ts` is a swappable `Proxy` that **hot-swaps at runtime** (no restart) via `reconfigurePool()`. `isDbConfigured()` is a cheap fs/env check for first-run routing.
- **First-run/recovery:** public **`/connect`** page (in middleware `PUBLIC_PATHS`) — reachable only while DB is unconfigured **or** unreachable; **self-locks** (API routes `403`) once the live DB works. Layouts + `/login` redirect to `/connect` when `!isDbConfigured()`.
- **Ongoing edits:** `/admin` **Database** tab (`admin.database_settings` permission). GET returns config **password-redacted**; blank password on save keeps stored one. Save validates → **tests connection** → persists + hot-swaps (**never** saves an unreachable config).

## Architecture

### Module Layout

Next.js **routes** stay in `app/` (the App Router requires route files there); all **non-route source** lives in `src/`. Each module keeps its clean-architecture layers under `src/{module}/` and its route files under `app/(authenticated)/{module}/`. `(authenticated)` is layout-only — does **not** change URLs; shares the header from `app/(authenticated)/layout.tsx`. Login is in `app/(auth)/`; the module launcher is `app/(authenticated)/page.tsx` (route `/`).

```
app/(authenticated)/{module}/
  page.tsx          ← client component ("use client") — route: /{module}
  api/route.ts      ← HTTP primary adapter (no business logic) — route: /{module}/api

src/{module}/
  domain/           ← entities, behaviors, repository port interfaces
  application/      ← use cases (pure orchestration), external service port interfaces
  infrastructure/   ← concrete adapters for all ports
```

`app/` holds **only** Next.js route files (`page`/`layout`/`route`) plus `globals.css` and `favicon.ico`. Everything else — components, hooks, and all layers — lives in `src/`, reached via the `@/*` → `./src/*` alias. Module-internal imports use **relative paths**.

Modules: `delivery`, `counting`, `invoice`, `transfer`, `replenishment`, `history`, `admin`, `location`, `supplier`, `manufacturer`.

**Rules — follow exactly:**
- **New module**: four-layer structure under `src/{module}/`, with its route files under `app/(authenticated)/{module}/`. **Nothing at project root.** **Never** create a module directory at project root (`delivery/`, etc.).
- **Never** use `/api/{module}`. API sub-routes live at `/{module}/api` (or more specific, e.g. `/{module}/scan`) — `page.tsx` and `route.ts` can't share a directory in Next.js.
- **Never** create re-export wrapper files (no `ui/Page.tsx`, no `api/index.ts`) — logic goes directly in `page.tsx` and `route.ts`.
- **Never** put business logic in `api/route.ts`: it resolves a use case from `src/container.ts` and maps request → input → HTTP response. Nothing more.
- **Shared code** (2+ modules) → `src/shared/`; single-module code stays in `src/{module}/`.
- `src/container.ts` imports modules via `@/{module}/...`; module-internal imports use **relative paths**.

### Shared (Cross-Cutting) — `src/shared/`

- `domain/` — `UserRole` type (`"admin" | "staff"`); augments NextAuth `Session`/`JWT` with `role`.
- `infrastructure/db.ts` — MySQL pool (mysql2/promise). `auth.ts` — NextAuth v5 (credentials + JWT); exports `{ handlers, signIn, signOut, auth }`. `authEdge.ts` — Edge-compatible auth for `middleware.ts`. `authConfig.ts` — shared NextAuth config (JWT strategy, callbacks).
- `ui/useScanner.ts` — hook detecting Bluetooth scanner input via rapid keydown bursts (< 50 ms between keys, min 3 chars, Enter-terminated); takes `onScan` + optional `enabled`. `ui/utils.ts` — `cn()` (clsx + tailwind-merge).

### Composition Root

`src/container.ts` is the single manual composition root: one named factory per use case (e.g. `createGetDeliveriesUseCase()`) wiring concrete adapters to interfaces. **No DI container library.**

### Landing Page

`app/page.tsx` (`/`) is the **module launcher** — home after login, not a data dashboard. Grid of tap-friendly cards; stub modules greyed "Coming Soon" and non-tappable. There is **no `/dashboard` route** — any reference to it is an error. A module card renders **only if** the user holds that module's **Open-*** permission; no permissions → "No modules assigned — contact an administrator" empty state. **Replenishment card** badge counts suppliers due today (next order date ≤ today, excluding unscheduled) — **computed on read, no cache**.

### Auth & Middleware

`middleware.ts` protects all routes (runs edge via `authEdge`; mysql2 not edge-compatible):
- **Only `/login` and `/api/auth` are public.** Every other route — incl. the `/location`, `/supplier`, `/replenishment` selection chain — requires a session. **Never** add business/selection routes to the public list; the check uses `startsWith`, so keep it minimal.
- Unauthenticated access to any protected URL (incl. deep links w/ query params) → `/login`. After sign-in the user **always** lands on `/`; requested URL **not** preserved.
- `/admin/*` requires **any** admin-tab permission; `/history/*` requires **View History**; module routes require the matching **Open-*** permission — else → `/`.
- JWT strategy; the user's **effective permission set** (union of active roles) embedded in the token at sign-in. DB-dependent gates (e.g. first-run setup flag) enforced in the authenticated server layout, **not** middleware.

**Authorization (RBAC)** (see `PRD-role-based-access-control.md`):
- Dynamic RBAC replaces the fixed `admin|staff` enum. App-owned `role` / `role_permission` / `user_role` tables (never ActiveOne). A user holds **multiple roles**; **effective permissions = union of active roles**, resolved at sign-in into the JWT — **changes apply at next login**.
- Permissions are a **FIXED code-defined catalog** in `src/shared/domain/` (single source of truth): module access, in-module supervisor actions, one permission per admin tab. Admins CRUD roles and toggle catalog permissions but **never invent new permission types**. **Every permission enforced server-side** (API/use-case), not just hidden in UI.
- Seeded **Administrator** role holds all permissions and is **protected** — existence + permission set locked, undeletable, cannot be disabled; **membership editable**. The `is_protected` system account is permanently pinned to it (break-glass) — so **no last-admin guard** needed. Seeded **Staff** role = Open Delivery/Counting/Replenishment only.

**Session lifetime & "Remember me"** (see `PRD-session-and-route-lockout.md`):
- Single **24-hour rolling (idle) window**, refreshed by NextAuth's native session check, enforced server-side. **No interval polling** (defeats idle timeout). Expiry detected via **window-focus re-check** (redirect to `/login` if expired) — no client-side idle timer. Sign-out clears session, redirects to `/login`, propagates across all tabs. Cookies: `httpOnly`, `sameSite=lax`, `secure` in production.
- **"Remember me"** (defaults **checked**) is additive: (1) **cookie persistence** — checked → persistent cookie surviving browser close, unchecked → session-only cookie (custom override of NextAuth defaults); (2) **per-device login picker membership** (see Fast Login).

**Fast Login** (see `PRD-fast-login.md`):
- `/login` is a **single route with three in-element widget states** — Picker → Password step → Manual entry — that **slide** (no URL change, fixed background); reduced-motion → cross-fade/cut.
- **Per-device user picker** in **localStorage** (never DB/server). Each entry `{ username, displayName, lastLoginAt }` — **never a password**. Cards show **display name only**; username retained silently to pre-fill/submit. Gated by "Remember me": **once remembered, always remembered until deleted** — unchecking later never removes. Most-recent-first, window of 5 (scrollable). Empty → open on Manual entry. Delete = swipe-left + confirm (accessible non-gesture fallback); **local only**, never touches the account.
- **Password always required** — selecting a user only skips typing the username. Missing/disabled account → **generic error** (no disclosure); stale cards **not** auto-removed.
- Login screen also carries branded content: logo + app name + `company_name`, a full-lineup feature carousel (no "Coming Soon" labels), a theme-aware animated gradient-blur background. All motion respects `prefers-reduced-motion`.

### UI Stack

- **Tailwind CSS v4** — CSS-first config (no `tailwind.config.js`); base styles in `app/globals.css`. **shadcn/ui** — installed to `src/shared/ui/` via `npx shadcn@latest add <component>` (routed there by `components.json` aliases). **lucide-react** for icons.

### Design System (full spec: `DESIGN.md` at repo root)

**Before building or modifying any UI, read `DESIGN.md`** — the rules below are a summary; `DESIGN.md` is the authoritative source.


- **Semantic tokens only** — **never** hardcode raw Tailwind colors (`bg-blue-600`) or hex. All color resolves through CSS-variable tokens in `app/globals.css`.
- **Token set** — shadcn base (`background`, `foreground`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring`, `card`, `popover`) + four status tokens: `critical`, `success`, `warning`, `incoming`. `primary` doubles as informational blue (no `info` token). `critical` (data needs attention) ≠ `destructive` (dangerous action). **Primary is blue** — don't change the brand color. Fonts: Geist Sans (UI) + Geist Mono (SKUs, PO numbers, data); don't add fonts.
- **Theming** — Light/Dark/System via `next-themes`, persisted per-device in localStorage (not DB). System default. No theme flash on load.
- **Account menu** — header dropdown on every authenticated page: name + role (read-only), theme control, **Change password** (self-service: current + new, min 8; session stays alive on success; all roles), Sign out.
- **Component primitives** — shadcn primitives in `src/shared/ui/`, variants defined once: Button, Badge, Input, Label, Checkbox, Card, DropdownMenu, Skeleton. Prefer over hand-rolled. Data tables stay semi-hand-rolled (token-based, not shadcn Table). One standardized disabled state.
- **Selection tiles** — shared `location`/`supplier` pattern in `src/shared/ui/`: single-select (tap → navigate) and multi-select (tap → toggle; full-tile accent border + tinted background + corner check).
- **Scale** — one `--radius` token drives all rounding (`lg`/`md`/`sm` derive). Named type scale (page title, section title, body, label, caption, data/mono) — use roles, not free sizes. **48px minimum touch target** (Android).
- **Quality** — token light/dark pairs meet WCAG AA (4.5:1); focus uses `ring` token; motion (`active:scale-95`, `animate-pulse`) gated behind `prefers-reduced-motion`.

### UI Consistency

**Before building any UI, copy an existing pattern — don't invent one.** A new visual treatment needs a reason; match the nearest canonical reference.
- **Reuse-first** — compose from primitives in `src/shared/ui/` (`Button`, `Badge`, `Card`, `Input`, `Checkbox`, `Dialog`, `Sheet`, `Tabs`, `Tooltip`, `SelectionTile`, …). **Never** hand-roll a button/input/card/dialog. If a primitive doesn't exist, **add it to `src/shared/ui/` first** (variants via `cva`), then use it.
- **Canonical references:** **Tappable selection/launcher cards** → home launcher `app/(authenticated)/page.tsx` (`<Card asChild>` wrapping a `<Link>`; `hover:border-primary hover:bg-accent motion-safe:active:scale-95`; icon `text-primary`); fork/choice screens use the same. **Date pickers + segmented toggles** → replenishment controls bar `app/(authenticated)/replenishment/page.tsx`: labeled `type-label text-muted-foreground` field wrapping `<Input type="date">`; segmented control = shared `SEG_TRACK` track + `seg()` helper (muted track, active segment `bg-background shadow-sm`) — don't re-derive a second segmented style. **Filterable list rows** → history list pages (`<button>` row, `border border-border bg-card`, `hover:bg-muted/50 motion-safe:active:scale-[0.99]`).
- **Enforced by lint** (`eslint.config.mjs`, fails build): no raw Tailwind palette colors (`bg-blue-600`) or hex in `className`; tap animation must be `motion-safe:` gated; no raw `font-mono` in `className` — mono (SKUs, PO codes, usernames, unit symbols) goes through the `type-data` role class.
- **Printable reports** — `@media print` stylesheet on the same page (hide app chrome/nav/buttons), `@page` landscape, monochrome-safe (**never** use color to convey meaning — use typographic markers). Reusable.

### Database & ERP

- MySQL (ActiveOne ERP). All access through `src/shared/infrastructure/db.ts`. **No ORM** — raw SQL via `pool.execute()`. Module DB logic lives in that module's `infrastructure/`.
- **ActiveOne has no API.** All integration (reads + write-backs like POs) is direct MySQL. **Never** design assuming an HTTP API.
- **ActiveOne has no receiving step.** Native flow is `Purchase Order → Enter Bill` only. `purchase_order_items.RECEIVED_QTY` is updated by Enter Bill — an open PO's `RECEIVED_QTY` stays `0` until billed. The `item_receive(_lines)` table is a **separate** process with **no FK to `purchase_order`** — **never** assume it links to or updates a PO. Delivery inserts this app as the missing step between PO and Enter Bill.

## Coding Principles

- **Clean Code** — names explain intent; functions do one thing; readable over clever; no abbreviations.
- **DRY** — shared logic → `src/shared/` (cross-module) or `src/{module}/` (module-local). Cross-module duplication = extract to `src/shared/`.
- **SOLID** — *SRP*: API handlers handle HTTP; DB queries are separate functions; UI components only render. *OCP*: extend via composition, not modifying shared kernel. *ISP*: pass only needed params; don't thread large objects through layers. *DIP*: use cases depend on port interfaces in `domain/`/`application/`; adapters in `infrastructure/`, wired in `container.ts`. Domain/application **never** import infrastructure.
- **YAGNI** — build only what the task needs. No config flags/generics/abstraction for "future flexibility."
- **Dependency Injection** — DB, ERP, scanner injected via interfaces; concrete impls never instantiated in domain/application. Wiring only in `container.ts`.
- **Design Patterns (when the problem fits)** — *Repository* (per-module DB access: interface in `domain/`, impl in `infrastructure/`); *Strategy* (scanner sources); *Observer* (`useScanner`); *Ports & Adapters* (storage ports in `domain/`, external-service ports in `application/`, impls in `infrastructure/`).
- **Naming** — no tautological prefixes/suffixes; folder gives layer context. `domain/Delivery.ts` not `DeliveryEntity.ts`; `domain/DeliveryRepository.ts` not `IDeliveryRepository.ts`. Only implementation detail earns a prefix: `infrastructure/MySQLDeliveryRepository.ts`.

### Clean Architecture Layer Rules

- `domain/` must not import `application/` or `infrastructure/`. `application/` may import `domain/` only. `infrastructure/` may import `domain/` and `application/`.
- `page.tsx` — UI adapter; no business logic; client-only; **never** import server-only code (DB, ERP, auth). `api/route.ts` — HTTP adapter; resolves use case from `container.ts`, maps request → input → response; server-only. `container.ts` — the **only** file importing `infrastructure/` to wire adapters.

### Also recommended

- **Fail Fast** — validate/reject bad input at the API boundary. **Command-Query Separation** — GET returns data, changes nothing; POST/PUT/DELETE change state, return minimal confirmation; never mix. **Single Source of Truth** — types (`UserRole`) defined once in `src/shared/domain/`; constants in one place. **Composition over Inheritance** — hooks + small components. **Immutability by default** — spread over mutate; `const` unless mutation required. **Law of Demeter** — talk only to immediate dependencies; avoid prop-drilling > 2 levels (lift to hook/context).

## Application Name

**Full:** Operations Hub · **Short:** Ops Hub (space-constrained surfaces) · **Technical id:** OperationsHub (package name, refs, docs).

**Page title convention:** all pages `{Company Name} · Ops Hub · {Module Name}` — middle dot `·` (U+00B7) separator. Company name from `app_settings` (key `company_name`), cached at `app/layout.tsx`, falls back to `"Operations Hub"`. Configured by admins via `/admin` — **never hardcoded**.

### `app_settings` Table

Key-value app config:
- `company_name` — title prefix. Seed `"Great Wall Trading"`. Also exposed via a **pre-auth public read** for the unauthenticated `/login` screen (fallback `"Operations Hub"`); returns **only** the company-name string.
- `setup_completed` / `setup_progress_step` / `setup_completed_at` / `setup_completed_by` / `setup_reset_at` / `setup_reset_by` — first-run wizard state (global, once-per-install).
- `delivery_continuous_scanning` (Delivery tab) / `counting_continuous_scanning` (Counting tab) — default ON. **No** Blind Counting setting (deliberately dropped — no ordered reference to blind against). Add settings (default location, date format) as needed — no schema change.

### `supplier_schedule` Table

Our own table (not ActiveOne): per-supplier order schedule.

| Column | Type | Notes |
|---|---|---|
| `supplier_id` | integer PK | ActiveOne Contact ID |
| `schedule_type` | enum('weekly','monthly','lead_time') | |
| `week_day` | integer nullable | 0=Sunday … 6=Saturday; weekly only |
| `month_day` | integer nullable | 1–31; monthly only |
| `last_ordered_at` | date nullable | Lead-time anchor; updated on every PO submission, all schedule types |
| `min_order_value` | decimal nullable | Optional per-supplier min ₱ order value (global, not per-location); NULL = unset. Spec'd in `PRD-replenishment-supplier-minimum-order.md` |
| `min_order_quantity` | integer nullable | Optional per-supplier min crude purchase-unit count; NULL = unset. Same PRD |
| `created_at` / `updated_at` | datetime | |

- Lead time (days) **not stored** — always fetched live from ActiveOne `Contact.CUSTOM_FIELD3`. No record and no `CUSTOM_FIELD3` = unscheduled. On PO submission, `last_ordered_at` updated for every supplier; if no record exists, one is created with `schedule_type = 'lead_time'`.
- Same MySQL DB as ActiveOne → `due_status` resolves in one query JOINing `supplier_schedule` against `Contact.CUSTOM_FIELD3`. **All due-date math uses `Asia/Manila` (UTC+8)** — never server-local or UTC. Weekly/monthly: configured day is due **on the day itself**. On first assignment, `last_ordered_at` pre-filled from the supplier's most recent ActiveOne PO (null only if no PO history).

## Modules

### `delivery` (see `PRD-delivery.md`)

Floor tool for receiving goods against an ActiveOne PO. Durable decisions:
- **Supersede-PO save (not `item_receive`).** On save, write a **new** open `purchase_order` (+ `purchase_order_items`) with actual received qtys and **close** the original (preserved, not deleted). New PO is **open** with `RECEIVED_QTY = 0`; stays incoming until an admin runs **Enter Bill** in ActiveOne (manual, out-of-app). Closing the original prevents double-counting in replenishment incoming. Audit: new PO `CUSTOM_FIELD1` = original PO ref, `CUSTOM_FIELD2` = receiver's ActiveOne employee code. ID/CODE minting copies replenishment (`MAX(ID)+1`, app-side `CODE` via `PO_CODE_PREFIX`); one atomic transaction.
- **PO selection:** searchable card grid of **open POs across all locations** (no location step). Search by PO code. **Excludes** POs with `CUSTOM_FIELD1` set (app-created delivery POs) to prevent a re-receive loop.
- **Scanning:** one scan = **+1 in the PO's purchase unit** (no base/purchase conversion during receiving). Barcode resolves to `item.CODE`. Five statuses: **Exact, Over Served, Under Served, Not Ordered** (in masterlist, not on PO), **New Item** (not in masterlist). Over-delivery never blocked. Ordered-but-unscanned lines written `QUANTITY = 0` (kept, not omitted). **New Items** (unknown SKUs) **never written to ActiveOne** (no real `ITEM_ID`) — stored only in `delivery_new_items` as `code` + literal `"New Item"`. Only on-PO and Not-Ordered lines (real `item.ID`) go to ActiveOne. Line costs: ordered lines copy original line `RATE`; Not-Ordered use `item.COST × factor` (RATE per purchase unit, `item.COST` per base unit); New Items use `0`.
- **Authorization:** pure scanning + **undo-last-scan** (decrement just-scanned by 1) need no auth. Every **other** manual qty change (arbitrary decrement, delete line, type a qty) requires the **"Adjust/Delete Delivery Lines" RBAC permission** — **no password re-entry, no cross-user authorize-as**; lacking it, control is hidden/disabled and the server re-checks on commit. Any role may **Save Delivery**, but save is **blocked** unless the user is linked to an ActiveOne **type-2 (employee)** contact (receiver → `CUSTOM_FIELD2`; link in `/admin`). At commit, original PO is **re-read and verified still open** (optimistic concurrency); reject if already superseded.
- **Resilience:** in-progress state persisted to `localStorage` (keyed per PO), cleared on save. Scan handler must process rapid back-to-back scans (Eyoyo batch dumps) without dropping any. Flow: PO grid → receiving → Review → save → success.
- **Continuous Scanning** (`delivery_continuous_scanning`, default ON = +1-per-scan): OFF opens an empty focused qty modal per scan that **adds** to the line (no auth, positive whole numbers only); swallows scans while open; cancel is a no-op; undo-last-scan reverses the whole last entry.
- **Settings binding:** blind mode is **live from settings**, re-evaluated at PO load (selection + entering a PO) — **not** snapshotted into `localStorage`; only the **saved** record durably stores the mode it was saved under. Configured in `/admin` **Delivery** tab. (`delivery_continuous_scanning` likewise unless proven otherwise.)
- **Blind discrepancy gate** (blind mode only; see `PRD-blind-delivery-discrepancy-gate.md`): Over and Not-Ordered lines are **hidden from staff, detected only at Review** (never surfaced at scan); the neutral block message reveals no item/qty/count. Save **blocked** until a user holding the **"Approve Delivery Discrepancies & Return Excess" RBAC permission** acts (no password prompt, no cross-user authorize-as — that user is the recorded approver); controls then reveal full blind-OFF detail. **Approve** = accept remaining discrepancies (balancing optional); balancing all away clears the block with no Approve. Under-delivery + accepted New Items **never** block save. Reload re-locks; a granted approval **persists in `localStorage`** until invalidated; auto-relocks on navigate-away/idle.
  - **Server-enforced:** a commit carrying Over/Not-Ordered lines is **rejected** unless the committer holds the approve permission and the approval matches those **exact** lines (alongside the original-PO-still-open check). Approval is bound to the flagged lines' received qtys; any **new** such line or an **increase** to an approved one **invalidates** it (decreases never do) — client + server.
  - **Return Excess:** secondary button in the line edit modal (Over/Not-Ordered lines only, confirm dialog) that **snaps received down to ordered qty** (Not-Ordered → 0). A returned/zeroed Not-Ordered line is kept as `QUANTITY = 0` in **our** tables for audit but **excluded from the ActiveOne superseding PO** — a carve-out from the ordered-line `QUANTITY = 0` rule.
- **Our tables:** `delivery` (one row per committed session), `delivery_new_items` (child), `item_master_cache` (`code` + `description`; ActiveOne masterlist cached for scan classification + Not-Ordered descriptions; refreshed via `/admin` button). Deferred: admin-override audit log; Enter Bill stays manual.

### `counting` (see `PRD-inventory-counting.md`)

Floor tool for counting stock at a location by scanning. Delivery's sibling (scan = +1, Continuous Scanning setting, Review step, per-action RBAC auth, `localStorage` resilience) but **no PO** — so **no Under/Over/Not-Ordered/New-Item statuses** and nothing to supersede. Durable:
- **Records counts only — NEVER touches on-hand.** `item_inventory` is never written. Writes ActiveOne `inventory_count` (header) + `inventory_count_items` (lines) with `STATUS = 3` (finalized), `ADJUSTED = 0`, `CLOSED = 1`, `DESCRIPTION`/`CUSTOM_FIELD*` null. Reconciling on-hand is a **separate deferred** process.
- **Partial count** — only scanned items written; screen starts empty, fills as you scan. **Unknown/unmapped barcode → rejected with feedback** (no New-Item capture; no valid `ITEM_ID`). No manual (non-scan) entry in v1. No Blind Counting.
- **Selection:** location-only via shared `/location` (`module=counting`; visibility in `module_location_visibility`). Each Save creates a **new independent** document — no supersede, no re-read; two people counting one location just make two documents.
- **Count/display unit** resolves per-location from `item_location_units` with factor from `item_units`; fall back to the item's global `PURCHASES_UNIT_ID` (or `BASE_UNIT_ID`), factor 1. Written to line `UNIT_ID` + `UNIT_BASE_QUANTITY`. Positive whole numbers only.
- **Attribution + save gate:** `inventory_count.COUNTED_BY_ID` = counter's ActiveOne **employee contact** (from `users.employee_code` → `ACCOUNT_NO`, TYPE 2); `RECORDED_BY_ID` = counter's **ActiveOne login-user** id via a **new per-user mapping** (new `users` column, set in `/admin` via a live picker over the ActiveOne `user` table). Both `NOT NULL` → **Save hard-gated on BOTH present** (plus a ≥1-line empty-count guard, at UI + API). Any role may Save.
- **Authorization:** pure scanning + undo-last-scan need no auth; **edit qty / delete line require the "Adjust/Delete Counting Lines" RBAC permission** — no password re-entry. Optional free-text note at Review → `inventory_count.NOTES`. `CODE` app-minted as the next zero-padded 4-digit sequence (independent of `ID`); dates in **Asia/Manila**.
- **Our tables:** `stock_count` + `stock_count_items` — our **immutable self-contained mirror** (human-readable labels + IDs, mode setting, ERP `inventory_count` ref), same atomic transaction. Named `stock_count` because ERP already owns `inventory_count`. **Counting History viewer deferred** (mirror populated now).

### `admin`

Tab-based `/admin` (admin-only). Tabs: location visibility; **Delivery** (continuous scanning, blind delivery); **Counting** (mirrors Delivery; holds `counting_continuous_scanning`, no blind toggle); **Order Scheduling** (supplier-schedule Kanban — Weekly / Monthly / Lead-time columns; drag to assign; Weekly prompts a weekday no default, Monthly prompts day 1–31 clamped to month length; cancel snaps back; search filters across columns; persists on confirm); **Database** (`admin.database_settings` — see Environment Setup).

**Users tab** (see `PRD-user-role-management.md`): manage Operations Hub accounts in `users` (never ActiveOne). Card list + slide-up sheet; confirm dialogs on deactivate + sensitive role grants. Role assignment **multi-select** over the RBAC `role` table.
- Operations: create, edit (name/username/roles), reset password, activate/deactivate. **Soft-deactivate only — never hard-delete** (`delivery.received_by_user_id` references users). Role/active changes at **next login** (JWT); deactivation blocks new logins immediately, not live sessions.
- **Employee link:** `employee_code` set via a **live searchable picker of ActiveOne type-2 (employee) contacts** — never free text. Optional, **non-unique**. Stale links keep the raw code, never auto-cleared. **ActiveOne login-user link:** separate per-user mapping via a **live picker over the ActiveOne `user` table**, stored in a new `users` column; used only as `inventory_count.RECORDED_BY_ID`; optional to set but **required to save an inventory count**.
- **System admin:** shipped account `is_protected = 1` — permanently pinned to **Administrator** + `is_active = 1`, fully locked in UI (no edit/reset/deactivate), no employee link; rotates its own password only via self-service. API rejects mutations to protected users with `403`. Passwords admin-set (min 8) on create/reset. Username collision → specific `409` "Username already taken". Audit log deferred.
- **`users` columns:** `id`, `name`, `username` (unique), `password_hash` (bcrypt), `is_active`, `employee_code` (nullable), `is_protected`, `created_at`, `updated_at`. (Legacy `role` enum migrated into RBAC `user_role` and retired.) New columns via the idempotent ALTER pattern in `create-app-tables.sql`; seed sets `is_protected = 1` on the shipped admin.

**Roles tab** (see `PRD-role-based-access-control.md`; **Manage Roles** permission): CRUD roles — card list + slide-up sheet with **grouped permission checkboxes** and **two-way member management** (assign roles from the user sheet *or* users from the role sheet). Admin access is **per-tab** (each tab its own permission). Role deletion **blocked while any user holds it** (`409` + member count); role names **unique** (`409` on collision, "Administrator" reserved); roles have an **enable/disable** toggle (disabled = no permissions). **Sensitive grants** (admin-tab / supervisor permissions, Administrator membership) prompt a confirm dialog. Per-action admin-password step-up gates are gone — governed by RBAC.

**Order Pooling tab** (see `PRD-replenishment-selling-area-demand-pooling.md`): app-owned feeder↔selling-area map (`selling_area_location_id` PK → `feeder_location_id`; never ActiveOne). **Selling-area-centric** editing, **feeder-grouped** display. Validation blocks self-feed, a location being both feeder and selling area, and chains. Computed on read — applies to next run.

### `replenishment`

A **replenishment run tool**, not a catalog browser — surfaces only items needing attention, all suppliers on one screen. "Sales rate" = daily units sold (off-take) from ActiveOne Invoices + SalesReceipts.
- **Available stock (effective):** `on_hand + incoming`, `incoming` = sum of undelivered qty across all open POs for the item, any origin. PO open if status = `0` (verify against live data).
- **Surfacing:** daily sales rate = `total_units_sold_in_range ÷ days_in_range` (default: last 30 days). DOS = `effective_available ÷ daily_sales_rate` (column, not filter). Show only items where `suggested_order > 0` for the group's order period. Exclude sales-rate-0 items. Flag **critical** where `DOS < supplier_lead_time_days`. **Suggestion:** `max(0, ceil_or_floor( daily_sales_rate × (order_period_days + supplier_lead_time_days) − effective_available ))`.
- **List layout:** items grouped by supplier (collapsible), **sub-grouped by manufacturer**. Supplier header: name · count · aggregate critical badge · **"Due" tag** if next order date today/tomorrow · tri-state checkbox (**no** order-period selector). Manufacturer header: checkbox · name · count · per-manufacturer critical badge · order-period selector (7/14/30, immediately re-filters/recalculates that sub-group). Items sorted alphabetically by description; "No Brand" (null `MANUFACTURER_ID`) pinned first, named alphabetical. Both levels collapse independently; global Expand/Collapse All affects both. All checkboxes default checked.
- **Header controls:** From/To date range · Order period (7/14/30, sets default for all sub-group selectors) · Rounding toggle (up/down).
- **PO flow (two-step):** main screen (review, adjust, uncheck, "Generate PO") → Review (supplier → manufacturer, per-item qty overrides, "Submit PO"). **Submission atomic** — server splits selected lines by **supplier + manufacturer**, one PO per combination; any failure rolls back all. `purchase_order.CUSTOM_FIELD3` = manufacturer name for named POs, `NULL` for "No Brand". Success → summary grouped by supplier, one row per manufacturer PO. POs written directly to ActiveOne MySQL.

**Unit of measure** — all qty columns display in each item's **purchase unit**, not base pieces.
- **Conversion:** (1) flatten line qtys to base: `QUANTITY × UNIT_BASE_QUANTITY` (invoice, sales-receipt, PO lines). (2) Resolve display unit + factor: `PURCHASES_UNIT_ID` non-null with matching `item_units` row (`ITEM_ID`+`UNIT_ID`) → factor = `item_units.QUANTITY`; non-null but no row → factor = 1; null → fall back to `BASE_UNIT_ID`, factor 1. (3) Divide base qtys by factor. DOS formula unchanged (factor cancels). Rounding applied after conversion → whole purchase units. **All unit data resolved in a single enriched SQL query** — no per-item round-trips.
- **UI:** single "Unit" column right after item name (main + review), showing `unit_of_measure.SYMBOL` (e.g. "cs", "pk", "pc"). Qty columns plain numbers; review override a plain whole-number field.
- **PO write-back:** `UNIT_ID = item.PURCHASES_UNIT_ID` (or `BASE_UNIT_ID` if null), `QUANTITY` = order qty in purchase units, `UNIT_BASE_QUANTITY` = resolved factor. **Never** write `UNIT_BASE_QUANTITY = 1` unless purchase unit truly is base.

**Per-piece ordering** (see `PRD-replenishment-per-piece-ordering.md`) — ad-hoc per-line toggle on **Review** (cases ⇄ pieces; hidden when purchase unit = base, factor 1). Switching recomputes the suggestion in **base units, ALWAYS round-up** (ignores the run's toggle); writes that PO line with `UNIT_ID = BASE_UNIT_ID`, `UNIT_BASE_QUANTITY = 1`, `RATE = COST`. **Run-time only** — no admin config / persisted flag; persisted in the run's localStorage draft. Both paths; one PO may **mix** case + piece lines. **Sub-case surfacing:** under round-**down**, items whose *unrounded* suggestion > 0 but rounds to 0 cases surface on the main list with a **"<1 cs"** badge, **default unchecked**. History: `replenishment_run_line.ordered_per_piece` flag (idempotent ALTER); per-piece lines store qty **in pieces** + base-unit `unit_symbol`.

**Per-supplier minimum order** (Standard only; see `PRD-replenishment-supplier-minimum-order.md`) — optional **₱** (pre-tax subtotal) and/or **qty** (crude purchase-unit sum) minimum per supplier, set in Admin → Order Scheduling, stored on `supplier_schedule`. Live indicator on supplier headers (main list + Review; hidden when unset; `warning` token when below); **non-blocking** confirm at Submit if the **per-supplier total** (summed across manufacturer-split POs) is below **either** minimum. **Advisory — no server gate.** Override acknowledgment + thresholds recorded in run history. The Standard enriched read query surfaces per-item **unit cost** to compute the ₱ running total client-side (cost was previously fetched only at PO-write time).

**Replenishment Worksheet** (Standard only; see `PRD-replenishment-worksheet.md`) — printable **pre-order** worksheet from the **LIVE** Standard run (before Generate PO). Lists **all active items** for the selected suppliers incl. 0-qty (adequate-stock/rounded-to-zero) **and zero-sales items inline**; blank **Order Qty** column for admin annotation on paper. Portrait, **new page per supplier**, monochrome; 0-qty rows carry a typographic marker. **Ephemeral client-side print — no persistence, no history record** (history is still written at PO submit). Any `module.replenishment` user; Standard tab only. Fetch reuses `GET /replenishment/api` with **`worksheet=true`** (full-catalog mode) — relaxes all three exclusions (`units_sold>0`, `dailySalesRate===0` guard, `rawOrder<=0`) to return every active item; zero-rate items carry rate 0 + DOS null; backward-compatible when the param is absent.

**Scoping** — all data scoped to a single ActiveOne location ID + selected suppliers. `/replenishment` requires `locationId` + `supplierIds`; missing either → selection chain. `locationId` present, `supplierIds` absent → `/supplier?returnTo=%2Freplenishment&locationId={id}`. Invalid `locationId` → show error in place of the screen.

**Manufacturer selection** (see `PRD-replenishment-manufacturer-selection.md`) — chain is `location → supplier → manufacturer → run`. `/manufacturer` is a four-layer shared selection module (gated by `module.replenishment`) listing manufacturers carried by the selected suppliers' active items (`DISTINCT MANUFACTURER_ID`, location-independent; null → "No Brand"), grouped per supplier, all checked by default; appends `manufacturerIds` to the run URL. Encoding: comma-separated `mfgKey` tokens `{supplierId}:{manufacturerId|nb}`; **omitted entirely = all** (no filter, backward-compatible). Both **Standard** and **Stockout** filter by exact `(supplier, manufacturer)` pair server-side (Stockout is scoped to the same selected suppliers — its query filters `PREFERRED_VENDOR_ID IN (supplierIds)`, so the older "location-only, all suppliers" wording is inaccurate). Aggregations (counts, critical badges, spend, tri-state) computed **after** filtering.

**Two paths (entry fork)** (see `PRD-stockout-replenishment.md`) — the home Replenishment card lands on `/replenishment` with a **Standard/Stockout tab toggle** (no separate path-choice screen); the home due-today badge is a Standard concern.
- **Standard** — the run tool above; chain location → supplier → screen.
- **Stockout** — surfaces currently-stocked-out items with sales history (breaks the loop where sales-rate-0 excludes long-stocked-out items). Scope **location-only** (no supplier step; all suppliers, still grouped by supplier for PO split). **Gate:** effective available = 0 **and** ≥1 sale in the ~13-month rollup (never-sold excluded). **Demand model:** anchor on most recent sale date; fixed 30-day window ending at it; `daily_rate = window base units ÷ 30` — divisor **always 30**. **Suggestion:** `round(daily_rate × (order_period + lead_time))`; reuses order-period + rounding; missing `CUSTOM_FIELD3` lead time → 0; surface only `suggested_order > 0`. **Screen:** like Standard but no From/To range; DOS/critical → dormancy context (last-sold date, 30-day rate, window units, unit, suggested qty); headers drop critical/Due badges; sort **alphabetically by description** ("No Brand" first); all checkboxes **default unchecked**. **PO flow:** reuses the **identical** two-step Generate → Review → Submit, atomic per-supplier + manufacturer split, `CUSTOM_FIELD3` write, and `last_ordered_at` write-back. **No** special tag distinguishing stockout POs.

**Selling-area demand pooling** (Standard only; see `PRD-replenishment-selling-area-demand-pooling.md`) — a configured **selling area** has its off-take **pooled into its mapped feeder warehouse's** sales rate; the selling area is **never independently replenished**. Combined rate = feeder + mapped selling areas; `effective_available` stays the **feeder's** on-hand+incoming (selling area's count excluded); DOS/critical/suggested use the **combined** rate. Rides the existing `item_sales_daily` rollup — **no schema change**; self-heal covers selling-area days. One feeder → many selling areas; each selling area → **exactly one** feeder; a location is never both. Zero mappings = today's behavior. **UI:** "Sales rate" column shows the **combined** rate; a **selling-area demand** column right of it breaks out the shelf portion (purchase unit, tooltip names the area). Shelf-only SKUs (feeder rate 0, selling-area rate >0) **surface** in the feeder's run, still supplier-scoped.

**Off-take rollup (`item_sales_daily`)** (see `PRD-sales-offtake-rollup.md`) — app-owned daily off-take rollup (idempotent `create-app-tables.sql` pattern; **never** ActiveOne), owned by `replenishment`. Exists because the live `sold` CTE scans ~1M+ POS lines/month (~7s).
- **Grain:** one row per `(location_id, item_id, sale_date)` = **summed base units** (`QUANTITY × COALESCE(UNIT_BASE_QUANTITY,1)`) across **both** `invoice_items` and `sales_receipt_items` (no source breakdown). Bucketed on the **raw source `DATE`** (not Manila-normalized). Same filters as the live `sold` CTE (`STATUS NOT IN (0,6,7)`; receipts also `RETURN_TRX=0` + `VOID_REFERENCE_NO IS NULL`). Sparse. Replaces **only** the `sold` CTE — unit conversion + DOS + on-hand stay live. **Sales-rate denominator stays the full calendar span** of the requested range, **never** the count of rollup rows.
- **Refresh:** nightly job recomputes a **trailing 7-day window** for **all locations** (absorbs late voids/returns); older history frozen. Triggered by an **external OS scheduler** (Windows Task Scheduler `.bat`) hitting a **POST endpoint gated by a shared-secret token** (env var, no session) — **not** an in-process timer or managed cron. All writes **idempotent** on the composite key.
- **Self-heal:** replenishment reads detect missing days and **compute-live-then-persist** them (both directions) — a **deliberate, scoped exception to command-query separation** (populates a recomputable cache, not business state). **Deploy backfill:** one-shot script consolidates the **last 13 months, all locations**, run **chunked**, with a **parity check** vs the live CTE before the rollup is trusted. **Admin:** lightweight `/admin` health panel (last refresh, covered range, rows/items) + manual **full rebuild** and **refresh-trailing-window-now**.

### `history` (see `PRD-history-module.md`)

Admin-only audit module. Home card → `/history` **fork-choice screen** (Replenishment History, Delivery History). Records committed **replenishment runs** and **delivery sessions** as app-owned, **immutable, self-contained snapshots** written **inside the same atomic transaction** as the PO/delivery commit (this module is GET-only). Snapshots store **human-readable labels** alongside IDs so records survive ActiveOne renames.
- **Replenishment history:** Standard + Stockout in **one combined list** (path-tagged); per-line **decision snapshot** — order period, rounding, sales rate, selling-area demand breakout, effective available, DOS, **system-suggested vs final qty** (overrides highlighted), plus stockout dormancy fields. Summary sectioned per ActiveOne PO. Row shows **supplier count** (not names).
- **Delivery history:** per-line ordered vs received + status, New Items, receiver, and **mode settings** (blind, continuous scanning). Row shows **both** original → new superseding PO refs. Blind sessions also record the **approving admin** (id + timestamp) and each **Return-Excess event** (line, received → returned-to qty); sessions where an admin approved an Over/Not-Ordered discrepancy carry a **distinct, filterable indicator**.
- **Search & filters:** reference search is **partial/contains** on PO code (replenishment: any constituent PO; delivery: original **or** new); combines **AND** with date range, location, supplier, created-by. Newest-first, paginated (no default date window). All timestamps + date-filter boundaries in **Asia/Manila**.
- **Read-only** — no edit/delete. Export: CSV of line rows + a print-only **landscape audit report** (via `@media print` on the same run-detail page): document header, per-PO Final-Qty subtotals + grand total, monochrome-safe (typographic override marker), repeated running header + Page X of Y / run-ref footer, no-row-split with repeated table headers.

### First-run setup wizard (`/setup`) (see `PRD-first-run-setup-wizard.md`)

One-time global wizard. Global `app_settings.setup_completed` flag = once per install across **any** device. While false: admins redirected to `/setup`; staff **soft-walled** (modules blocked, header/account-menu/sign-out stay). Four **linear** steps embedding the matching `/admin` tab components: General (company name — **required**) → Users → Location visibility → Delivery. Per-step commit; **global** progress marker resumes at last step; strictly linear Back/Next with "Step X of 4"; slide gated behind `prefers-reduced-motion`. Finish → success → `/`. Gate enforced in the **authenticated server layout** (not edge middleware); cached flag invalidated on Finish/Reset. `/setup` exempt from its own gate. **Reset** in `/admin` **General tab**: **non-destructive re-arm only** (existing values pre-fill), confirm dialog **+ password re-entry**. Reset is **never destructive** — never wipes settings/users/config (users are FK-referenced, never hard-deleted); this is the standard for any "reset" action.

### `location` (shared selection module) — route `/location`

Navigation hub, not business logic.
- **Query params:** `module` (required) — filters visible locations; `returnTo` (required) — redirect after selection, gets `?locationId={id}` appended.
- **Visibility:** locations from ActiveOne; per-module per-location hidden flag in our `module_location_visibility` table (absent = visible). "Show all locations" toggle reveals hidden ones, muted. Toggled per module from `/admin` (no sub-route).
- **Selling areas:** configured replenishment selling areas are grayed-out/disabled (with a "Fed by {feeder}" note) **only** when `module = replenishment` — selectable normally elsewhere.
- **URL convention:** pass location as `?locationId={id}` query param (not a path segment).

### `supplier` (shared selection module) — route `/supplier`

Navigation hub, no business logic.
- **Query params:** `returnTo` (required) — URL-encoded path + query, gets `&supplierIds={comma-separated}` appended; `supplierIds` (optional) — pre-select on load. No `module` param.
- **Behavior:** fetches all suppliers (no per-module filtering). Multi-select 2-column selection-tile grid matching `/location` tile size; selected = full-tile treatment + corner check. "← Home" link. Search filters by name (case-insensitive, partial); filtered-out items keep selection. "Continue (N selected)" disabled at N=0. **Data source:** ActiveOne `Contact` table, `type = 3`.
- **Due sections:** three labeled — **Due Today** (next order date ≤ today, incl. overdue), **Due Tomorrow**, **Others** (rest, incl. unscheduled). Due Today sorted most-overdue first then alphabetically; Due Tomorrow + Others alphabetical. Overdue and due-today treated identically. **Tile annotation:** scheduled suppliers show "Next order: [date]"; unscheduled show no line (unscheduled = no weekly/monthly schedule and no `Contact.CUSTOM_FIELD3` lead time).

### `manufacturer` (shared selection module) — route `/manufacturer`

Navigation hub, no business logic. Replenishment-chain step after supplier. Gated by `module.replenishment`.
- **Query params:** `returnTo` (required) — gets `&manufacturerIds={tokens}` appended; `supplierIds` (required) — builds the list; `manufacturerIds` (optional) — pre-select on load. Preserves other params (e.g. `locationId`) on Continue. Missing `returnTo` or `supplierIds` → in-place error.
- **Behavior:** manufacturers carried by the selected suppliers, **grouped per supplier** ("No Brand" first, then alphabetical), all checked by default. Name search, per-supplier tri-state + global select-all/clear-all, "Continue (N selected)" disabled at N=0. When all remain selected, `manufacturerIds` is **omitted** (= all). **Data source:** ActiveOne `item` (`PREFERRED_VENDOR_ID`, `MANUFACTURER_ID`) + `manufacturer` table.

**Selection chain (location + supplier + manufacturer), e.g. replenishment:**
- `/location?module=replenishment&returnTo=<enc /supplier?returnTo=<enc /manufacturer?returnTo=%2Freplenishment>>`
- Location appends → `/supplier?returnTo=%2Fmanufacturer%3FreturnTo%3D%252Freplenishment&locationId=1`
- Supplier appends → `/manufacturer?returnTo=%2Freplenishment&locationId=1&supplierIds=2,3,5`
- Manufacturer appends → `/replenishment?locationId=1&supplierIds=2,3,5&manufacturerIds=2:5,2:nb,3:9`

## Project Context

Operations hub for Davao Great Wall Trading. Bridges gaps in ActiveOne ERP — delivery tracking, inventory counting, invoicing, stock transfers, replenishment planning. Middleware between Eyoyo Bluetooth barcode scanners and ActiveOne. Target runtime: Android mobile/tablet browsers. Most modules are stubs — early scaffolding phase.
