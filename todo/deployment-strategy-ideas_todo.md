# Deployment Strategy — Inno Setup Installer — Feature Ideas

Captured 2026-09-03. Not yet scoped — each Tier 1 item likely warrants its own
PRD before implementation.

Context: The app is a Next.js 15 ops hub that talks over the network to a local
ActiveOne/MySQL DB (the DB config, via `data/db-config.json` or `DB_*` env, is
what decides whether the app and DB are co-located). Today the only "deployment"
is manually copy-pasting **all** files to a target Windows PC (slow — it's every
file), and a Task Scheduler job fires a run script that **starts the server only**.
Android tablets reach it over LAN HTTP. There is no production hosting/process
strategy, no build artifact, no installer, and no update path. The goal of this
brainstorm is a self-contained **Inno Setup `.exe` installer** that installs only
the **required files** onto the target PC, bootstraps a run, and starts the app —
plus an in-place update story.

Design choices confirmed with the developer:
- **Packager:** Inno Setup — a committed `.iss` script compiled with ISCC.
- **Runtime:** the installer **requires Node** on the target; the run script
  **automatically runs `npm ci`** (and, per the build question below, a build or
  serve of a shipped artifact) before starting the server.
- **Startup:** Task Scheduler at logon/boot runs the start script (matches today's
  model).
- **Updates:** **swap-in-place** — the installer overwrites the app folder with the
  new package; preserves `data/db-config.json` + env/config so settings survive.

Open fork carried forward (flag for the PRD/plan): **where the production build
happens.** Because CLAUDE.md notes `next build` **hangs** in the local Windows dev
environment (environmental — AV/Turbopack cache), if the target PC is expected to
build, confirm a clean build actually completes there. Otherwise ship a prebuilt
`.next` in the package and have the target only `npm ci` + `next start`. This
decision changes what "required files" are.

## Tier 1 — Highest value
- [ ] **Committed Inno Setup `.iss` install script** — a text `.iss` at the repo
  root (or `scripts/installer/`) that defines the install layout, file list,
  required-files-only selection, and post-install actions. Compile with ISCC →
  a single `OperationsHub-Setup.exe`. One-line rationale: replaces the slow
  copy-everything flow with one double-click installer for the target PC.
- [ ] **"Required files only" file manifest** — the `.iss` `[Files]` section ships
  the app **minus regenerables**: no `node_modules/`, no `.next/` (or, if a
  prebuilt artifact is the approach, ship only `.next/standalone` + static). Keeps
  `data/` empty + gitignored so first boot configures it. One-line rationale: the
  whole point — kill the "copy-paste all files is slow" pain.
- [ ] **Prereq check for Node + first-run `npm ci`** — installer (or the start
  script) verifies Node is present (with a clear failure message + version), and
  the run script runs `npm ci` (or `npm install`) before starting so the target
  never ships a stale `node_modules`. One-line rationale: target runs clean deps
  from a known `package-lock.json` with no vendored binaries.
- [ ] **Task Scheduler registration at install** — installer (via `schtasks /create
  /tn "OpsHub-App" /sc ONLOGON ... /ru SYSTEM`) starts the app at boot/logon, so
  the server is always up for the tablets. One-line rationale: auto-start without
  an operator touching the box each reboot.
- [ ] **Preserve config on reinstall/update** — the installer must not clobber
  `data/db-config.json` (DB/ActiveOne connection saved from the UI), `.env.local`
  (`AUTH_SECRET`, `ROLLUP_REFRESH_TOKEN`), or `app_settings` state (those live in
  the DB). Use Inno's `[Files]` `onlyifdoesntexist`/`skipifsourcedoesntexist` or an
  exclude so swap-in-place updates keep the working connection. One-line rationale:
  an update that silently wipes the DB config breaks every tablet until re-setup.

## Tier 2 — Strong, moderate effort
- [ ] **Build-artifact packaging script** — a committed `scripts/pack.ts` /
  `.ps1` that, on the dev/build machine, runs the production build and produces
  exactly what the `.iss` `[Files]` section consumes (zip or folder), keeping the
  `.iss` file list in sync with the built output. One-line rationale: keeps "what
  ships" reproducible and not hand-edited per release.
- [ ] **Version the package + mark the install** — embed the `package.json`
  semver into the installer name (`OperationsHub-Setup-1.0.0.exe`) and into a
  version marker on the installed box (reuses the existing `version.ts` build-time
  constant); record installed version + date to `app_settings` or a small install
  file. One-line rationale: lets support ask "what's installed" and drives the
  update/rollback story (ties into `todo/versioning-ideas_todo.md`).
- [ ] **Non-destructive uninstall** — Inno uninstall removes app files but leaves
  `data/`, `.env.local`, and any scheduled task/process in a known state (or offers
  to remove them explicitly). One-line rationale: uninstall must never orphan the
  DB config or leave the rollup schtask pointing at nothing.

## Tier 3 — Convenience / workflow
- [ ] **`start.bat`/`start.ps1` committed in-repo** — a single script that runs
  `npm ci`, optional build, then `npm run start` (wired into the scheduled task).
  One-line rationale: today's run script is ad-hoc on the box; make it versioned and
  shipped.
- [ ] **Health/version check surface** — after install, a way to confirm the server
  is up and on which build (e.g. hit the root, reuse the account-menu version line).
  One-line rationale: post-install confidence the tablets can connect.

## Suggested starting point
Tackle the **Tier 1 core as one coherent slice**: the committed `.iss` installer
with a required-files manifest + Node prereq/first-run `npm ci` + Task Scheduler
registration + config-preserving update. Resolve the **build-location fork first**
(prebuilt `.next` shipped vs. build-on-target) because it determines the file
manifest and the run script — recommend **standalone output (`output: 'standalone'`)
shipped in the package, target runs `npm ci` (if deps ship) then `next start` on
the standalone server**, unless a clean build is proven on the target. Everything
else layers on top of that.
