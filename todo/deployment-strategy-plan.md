# Implementation Plan: Deployment — Inno Setup Installer (required-files package)

Source: [deployment-strategy-ideas_todo.md](deployment-strategy-ideas_todo.md)
Date: 2026-09-03

## Summary

Replace the "copy-paste all files, run via Task Scheduler" flow with a **committed
Inno Setup `.iss` installer** that ships only the required runtime files to a target
Windows PC, verifies Node is installed, runs `npm ci` + a production build once at
install, and registers a **Task Scheduler** job that starts the app at boot/logon.
Updates are **swap-in-place**: reinstalling overwrites the app folder while
preserving `data/db-config.json`, `.env.local`, and `app_settings` (DB-stored), so
every tablet keeps its working connection. Ship **source** (all app files minus
regenerables); build happens **on the target at install time** (not every start, not
a prebuilt artifact).

This is an ops/tooling workstream — it touches **no app module code, no schema, no
four-layer structure**. It adds build/packaging scripts plus an installer script at
the repo root/`scripts/`.

## Affected Areas

- **New files (no clean-architecture impact):**
  - `installer/OperationsHub.iss` — the Inno Setup script (compiled by ISCC).
  - `installer/include/…` (optional) — shared `.iss` snippets if reused.
  - `scripts/install-app-deps.ps1` (or `.bat`) — install-time `npm ci` + build step
    run by Inno `[Run]` (needs to be a shipped file the target runs; Inno can't
    natively shell `npm`).
  - `scripts/start-app.bat` — committed start script the scheduled task invokes
    (runs `npm run start`, i.e. `next start`).
  - `scripts/register-app-task.bat` (or Inno `[Run]` schtasks call) — registers the
    boot/logon scheduled task; optional Uninstall task cleanup.
- **Config:** `package.json` scripts (`start` already exists: `next start`).
- **No DB / no `create-app-tables.sql` / no `container.ts` / no module changes.**
- **Reused:** Node already required by `package.json`; existing `npm ci`-compatible
  `package-lock.json`; `next start` = the existing `start` script.

## Decisions

- **Resolved by developer — Ship form:** *Source + install-time build*. Installer
  ships app source minus regenerables; install runs `npm ci` once then `npm run
  build` once (via Inno `[Run]`); the scheduled task only runs `npm run start`.
  Rationale: fastest boots, deps pinned to `package-lock.json`, target can rebuild.
- **Resolved by developer — Packager:** Inno Setup (`.iss`, compiled with ISCC.exe).
- **Resolved by developer — Startup:** Task Scheduler at logon/boot runs the start
  script (matches today's model).
- **Resolved by developer — Updates:** swap-in-place; preserve config.
- **Resolved by developer (brainstorm) — Connection location:** app may be co-located
  with or remote to the DB; `data/db-config.json` / `DB_*` env governs it. Installer
  must treat config as untouchable runtime state.
- **Assumptions:**
  - The target PC has internet/registry access for `npm ci` at install time.
  - `next build` succeeds on the **target** PC (CLAUDE.md's hang is specific to this
    dev box / AV environment, not necessarily the target; verify during UAT — see
    Risks).
  - Inno Setup is not installed on this dev box today (`ISCC.exe` absent) — the
    implementer runs ISCC on a machine that has it, or installs Inno Setup 6 first.
  - `AUTH_SECRET`, `ROLLUP_REFRESH_TOKEN`, and any `DB_*` come from `.env.local`
    which is **never** committed/shipped into the installer `[Files]` — first run of
    the installed copy still reads/creates its own config (see note below).

## Implementation Steps

### Step 1 — Installer-only file list / source manifest
Define what the `.iss` `[Files]` section ships **from a prepared staging folder**,
never from raw repo state. Recommended approach: build the staging folder with a
script, then point Inno `[Files] Source` at it. Required files:
- Source (recursive): `app/`, `app` route groups, `container.ts`, `middleware.ts`,
  `next.config.ts`, `postcss.config.mjs`, `components.json`, `tsconfig.json`,
  `eslint.config.mjs` (not strictly runtime but harmless), `package.json`,
  `package-lock.json`, `public/` (if exists), `data/` (empty dir only).
- **Excluded (regenerable / local):** `node_modules/`, `.next/`, `out/`, `build/`,
  `.env*`, `data/db-config.json`, `*.tsbuildinfo`, `next-env.d.ts`, `.claude-archive/`,
  `.git/`, `installer/` itself, `todo/`, `docs/` (only if not needed at runtime — keep
  out to shrink).
- **Reasoning:** mirrors `.gitignore` (lines 1–44) — the installer should ship
  roughly the git-tracked source minus tooling/docs, plus empty `data/`.

Mirror the exclude semantics of `.gitignore` rather than re-authoring a second list.

### Step 2 — `scripts/install-app-deps.ps1` (install-time npm ci + build)
Run by Inno `[Run]` *after* files are placed and Node is verified.
- `Set-Location "$PSScriptRoot\.."` (the install dir, e.g. `{app}`).
- `npm ci --no-audit --no-fund` (fails the install if registry unreachable —
  surface the error via `[Run]` `Flags: runhidden` or a small visible console).
- `npm run build` (production build on target).
- Exit non-zero propagates as an install failure so the operator knows deps didn't
  land.
- **Do not** create `.env.local` here — see Step 4.

### Step 3 — `scripts/start-app.bat` (scheduled-task entrypoint)
- `cd /d "%~dp0.."`
- `npm run start` (maps to `next start`). Optionally bind port: default 3000; if a
  fixed port is wanted, add `start` `-p` later — keep default for v1 (matches today).
- Marked as the command the scheduled task runs; **no** `npm ci`/build here (already
  done at install) so boots are fast.

### Step 4 — `installer/OperationsHub.iss` (the Inno script)
Author against Inno Setup 6. Key sections:
- `[Setup]`: `AppId=OperationsHub`, `AppName=Operations Hub`,
  `AppVersion={#AppVersion}` (defined from package.json semver), `DefaultDirName={pf}\OperationsHub` (or `{localappdata}\OperationsHub` to avoid UAC — pick `{localappdata}` so a normal user can install without elevation and the scheduled task can run without admin), `PrivilegesRequired=lowest` (if `{localappdata}`), `OutputBaseFilename=OperationsHub-Setup-{#AppVersion}`, `SolidCompression=yes`.
- `[Languages]`/`[Messages]`: default.
- **Node prereq check** (`[Code]` function `CheckNode` in `InitializeSetup`):
  - `WhereIsNodeExe`: try registry/`where node` → if missing, `MsgBox` with a clear
    "Node.js ≥ 18 is required — install from nodejs.org" and return `False`.
  - Optionally parse `node -v` and enforce a minimum major.
- `[Files]`: ship the **staged** required-files folder (Step 1) into `{app}`. Use
  `Flags: ignoreversion recursesubdirs`. Preserve config by **excluding** the files
  you must not overwrite (see Step 5 for how).
- `[Run]`: run `scripts\install-app-deps.ps1` (via `powershell -ExecutionPolicy
  Bypass -File`), then `scripts\register-app-task.bat` — or register the task inline
  with `schtasks /create` in a `[Run]`/`[Code]` AfterInstall hook. Order: files →
  deps/build → register task.
- `[UninstallRun]` / `[Code]` `CurUninstallStepChanged`: optionally delete the
  scheduled task (`schtasks /delete /tn "OpsHub-App" /f`) so an uninstall doesn't
  orphan a task pointing at a missing app. Leave `data/` + `.env.local` on disk
  (non-destructive — Tier 2 refinement; v1 may delete cleanly, but **prefer leaving
  config** per brainstorm).

### Step 5 — Config-preservation rule (critical)
Because updates are swap-in-place, the installer must **never clobber**:
- `data/db-config.json` (the UI-saved ActiveOne connection).
- `.env.local` (`AUTH_SECRET`, `ROLLUP_REFRESH_TOKEN`, `DB_*`).
- DB-stored state (`app_settings`, tables) — inherently preserved (it's in MySQL).

Mechanisms (pick in the `.iss`):
- Exclude these from `[Files]` via a staging manifest that does not include them
  (cleanest — never staged), **and** set Inno so an existing install isn't deleted
  first: use default uninstall-on-reinstall behavior but mark the two files with
  `[Files] ... Permissions` + `onlyifdoesntexist` as a belt-and-suspenders, OR
  instruct Inno to not remove unknown files (Inno keeps files it didn't install when
  a newer installer runs — verify; safest is to stage configs out entirely and rely
  on "Uninstall deletes only files it installed").
- Result: installing 1.0 then 1.1 leaves the running DB config untouched; the app
  boots against the same connection.

### Step 6 — Register the boot/logon scheduled task
`schtasks /create /tn "OpsHub-App" /tr "C:\...\scripts\start-app.bat" /sc ONLOGON
/ru <user> /rl LIMITED /f` (or `/ru SYSTEM` if run under SYSTEM — decide with the
chosen install dir; SYSTEM needs the app dir readable by SYSTEM). Confirm the app
auto-starts and stays up after reboot. (The existing rollup refresh schtask
`OperationsHub-SalesRollup` is separate and unaffected — the app server must be
running for that POST to reach the endpoint.)

### Step 7 — Verify (no `next build` on this dev box — see CLAUDE.md)
- `npx tsc --noEmit` + `npm run lint` unaffected (no app code changed).
- Authoring check: ISCC is not on this machine; compile `installer\OperationsHub.iss`
  on a machine with Inno Setup 6 (or install it). Confirm the produced
  `OperationsHub-Setup-<ver>.exe` installs to a clean target, runs `npm ci` + build,
  starts via the scheduled task, and a second install (update) preserves
  `data/db-config.json` + `.env.local`.

## Risks & Open Questions

- **Target build success is unverified.** CLAUDE.md documents that `next build`
  hangs in this dev environment (AV/Turbopack cache, environmental). Confirm a clean
  `npm ci && npm run build` completes on the actual target PC; if the hang is
  machine-wide, fall back to shipping a prebuilt `.next` (standalone) instead of
  build-on-target — a follow-up decision.
- **Install dir + task account coupling.** `{pf}` needs elevation; `{localappdata}`
  doesn't but SYSTEM may not read a per-user dir. The chosen `[Setup]` dir and the
  scheduled-task `/ru` must be consistent for the boot-start to work.
- **`.env.local` bootstrap on first real install.** The installer ships no secrets.
  First run needs `AUTH_SECRET` + `ROLLUP_REFRESH_TOKEN` + optional `DB_*`. Decide:
  an operator places `.env.local` once after install, or the installer generates a
  random `AUTH_SECRET` if absent. (Do not ship the dev machine's secrets.)
- **Update UX.** Swap-in-place with Inno = reinstall over the top. Confirm the
  running app is stopped (task not firing mid-copy) — likely acceptable for a
  maintenance window; note it in docs.
- **Rollback.** Single-folder swap has no versioned rollback. If needed later, add
  versioned folders + a pointer — deferred (Tier 3).
