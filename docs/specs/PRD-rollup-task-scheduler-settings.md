# PRD: Sales Rollup — Task Scheduler Settings
Date: 2026-06-29

## 1. Overview
The existing Sales Rollup tab in `/admin` gains a new **Task Scheduler** section that surfaces the live status of the `OperationsHub-SalesRollup` Windows Scheduled Task and lets admins install or reinstall it with configurable settings. The nightly run time and trailing-window days are persisted to `app_settings` and applied atomically when Install or Reinstall is clicked.

## 2. Goals
- Admins can see at a glance whether the scheduled task is registered on the host, and when it last ran and is next scheduled to run.
- Admins can install the task from the UI without touching the command line.
- Admins can change the run time or trailing-window days and apply both changes with a single Reinstall action.
- The rollup endpoint reads trailing-window days from `app_settings` at runtime — no curl command change required when days change.
- Broken configurations (missing env vars) are blocked at the UI layer before any task operation.

## 3. Non-Goals
- No uninstall action.
- No live polling — status is fetched fresh on page load only.
- No separate App Base URL env var — `NEXTAUTH_URL` is reused.
- No audit log of install/reinstall history.
- No changes to the existing health panel content (last refresh, covered range, rows/items).

## 4. Users & Roles
Admin-only. The Task Scheduler section is within `/admin`, which already enforces `role === "admin"`.

## 5. Functional Requirements

**FR-1** On page load, the server calls `schtasks /query /tn "OperationsHub-SalesRollup" /fo LIST /v` and parses the result to determine: installed (boolean), last run time, last result code, next run time.

**FR-2** The Task Scheduler section displays:
- Installed / Not Installed status badge.
- If installed: Last Run (datetime + result code), Next Run (datetime).
- Configurable fields: Trailing-window days (integer, min 1, max 30, default 7) and Nightly run time (HH:MM time picker, default 00:00).
- If not installed: **Install** button.
- If installed: **Reinstall** button.

**FR-3** Install and Reinstall are disabled — and a warning is shown — if either `NEXTAUTH_URL` or `ROLLUP_REFRESH_TOKEN` env vars are missing or empty. The check runs server-side; the page load response includes a `configError` flag with a descriptive reason.

**FR-4** Trailing-window days is validated client-side (integer, 1–30) before enabling Install/Reinstall. Invalid input disables the button.

**FR-5** When Install or Reinstall is clicked, the server:
1. Persists `rollup_trailing_window_days` and `rollup_run_time` to `app_settings`.
2. Runs `schtasks /create /tn "OperationsHub-SalesRollup" /tr "<curl command>" /sc DAILY /st <HH:MM> /ru SYSTEM /f`. The `/f` flag overwrites an existing task idempotently.
3. Returns success or the raw `schtasks` error string.

**FR-6** The curl command baked into the task is: `curl -s -o NUL -X POST "{NEXTAUTH_URL}/replenishment/api/rollup/refresh" -H "Authorization: Bearer {ROLLUP_REFRESH_TOKEN}"`. Trailing-window days are **not** in the curl command — the endpoint reads from `app_settings`.

**FR-7** On success, the section refreshes its status (re-queries schtasks) and shows a success toast. On failure, the raw OS error string is shown inline beneath the button.

**FR-8** Settings (trailing-window days, run time) are **only persisted when Install or Reinstall is clicked** — there is no independent save.

**FR-9** The `/replenishment/api/rollup/refresh` endpoint is updated to read `rollup_trailing_window_days` from `app_settings` (falling back to 7 if not set) instead of a hardcode.

**FR-10** The existing `scripts/schedule-rollup-refresh.bat` is moved to `scripts/archived/schedule-rollup-refresh.bat` and left intact as a fallback.

## 6. Data Model

**`app_settings` additions** (key-value, existing table):
| Key | Type | Default | Notes |
|---|---|---|---|
| `rollup_trailing_window_days` | integer (stored as string) | `"7"` | 1–30; read by rollup endpoint at runtime |
| `rollup_run_time` | string (HH:MM) | `"00:00"` | Written on install/reinstall |

No new tables required.

## 7. API Contract

**`GET /admin/api/rollup-schedule`**
Response:
```
{
  installed: boolean,
  lastRunAt: string | null,       // ISO datetime or "N/A"
  lastRunResult: string | null,   // raw result code string
  nextRunAt: string | null,       // ISO datetime or "N/A"
  trailingWindowDays: number,     // current app_settings value (or default 7)
  runTime: string,                // HH:MM, current app_settings value (or "00:00")
  configError: string | null      // null if OK; descriptive reason if NEXTAUTH_URL or token missing
}
```

**`POST /admin/api/rollup-schedule/install`**
Request body: `{ trailingWindowDays: number, runTime: string }`
Response on success: `{ ok: true }`
Response on failure: `{ ok: false, error: string }` (raw schtasks error)

## 8. UI/UX Flow

1. Admin opens `/admin` → Sales Rollup tab.
2. Existing health panel (last refresh, covered range, rows/items) renders as-is at the top.
3. Below it, a new **Task Scheduler** section renders with status fetched from `GET /admin/api/rollup-schedule`.
4. If `configError` is non-null: an amber warning banner explains the missing env var; Install/Reinstall is disabled.
5. If not installed: fields show defaults (7 days, 00:00); **Install** button is shown.
6. If installed: fields show saved values; Last Run and Next Run are displayed; **Reinstall** button is shown.
7. Admin edits trailing-window days or run time. Client-side validates range; button enables/disables accordingly.
8. Admin clicks Install or Reinstall → loading state on button → server responds → toast on success or inline error on failure.
9. On success: section re-fetches status and updates Last Run / Next Run / installed badge.

## 9. Edge Cases & Error Handling

| Case | Response |
|---|---|
| `NEXTAUTH_URL` or `ROLLUP_REFRESH_TOKEN` missing | Warning banner; Install/Reinstall disabled |
| `schtasks /create` fails (permissions, name collision) | Raw OS error string shown inline beneath button |
| `schtasks /query` fails (task not found) | Treated as Not Installed |
| `schtasks /query` returns `N/A` for last run (never run) | Display "Never" |
| Trailing-window days outside 1–30 | Client-side validation; button disabled |
| `rollup_trailing_window_days` missing from app_settings | Endpoint falls back to 7; panel shows 7 as current value |

## 10. Open Questions
None — all angles resolved.

## 11. Out of Scope / Deferred
- Uninstall action.
- Live status polling (auto-refresh).
- Audit log of install/reinstall events.
- Multi-server / clustered deployment considerations.
- `.bat` wrapper script for the task itself (task runs `curl` directly).
