# Implementation Plan: Sales Rollup — Task Scheduler Settings
Source PRD: [PRD-rollup-task-scheduler-settings.md](PRD-rollup-task-scheduler-settings.md)
Date: 2026-06-29

## Summary

Adds a **Task Scheduler** section below the existing Rollup Health panel in the admin Sales Rollup tab. The section surfaces live Windows Task Scheduler status for `"OperationsHub-SalesRollup"` and lets admins install or reinstall the task with configurable run time and trailing-window days. Two new API routes back the section. The trailing-window days setting (`rollup_trailing_window_days` in `app_settings`) is also wired into `RefreshSalesRollupUseCase` so the nightly task and admin actions share a single source of truth instead of the current hardcoded `7`.

## Affected Areas

### Modules / Layers Touched

| File | Change |
|---|---|
| `app/(authenticated)/admin/application/TaskSchedulerPort.ts` | **New** — port interface for OS scheduler queries and install |
| `app/(authenticated)/admin/application/GetRollupScheduleStatusUseCase.ts` | **New** — reads task status + app_settings |
| `app/(authenticated)/admin/application/InstallRollupScheduleUseCase.ts` | **New** — saves settings + installs/reinstalls schtask |
| `app/(authenticated)/admin/infrastructure/WindowsTaskSchedulerAdapter.ts` | **New** — schtasks shell adapter |
| `app/(authenticated)/admin/api/rollup-schedule/route.ts` | **New** — `GET /admin/api/rollup-schedule` |
| `app/(authenticated)/admin/api/rollup-schedule/install/route.ts` | **New** — `POST /admin/api/rollup-schedule/install` |
| `app/(authenticated)/admin/page.tsx` | **Edit** — add Task Scheduler card to rollup tab |
| `app/(authenticated)/replenishment/application/RefreshSalesRollupUseCase.ts` | **Edit** — remove hardcoded `TRAILING_WINDOW_DAYS`; accept `windowDays: number` constructor param |
| `app/(authenticated)/replenishment/api/rollup/refresh/route.ts` | **Edit** — read `rollup_trailing_window_days` before calling use case |
| `app/(authenticated)/admin/api/rollup/route.ts` | **Edit** — read `rollup_trailing_window_days` for the `"refresh"` action |
| `container.ts` | **Edit** — update `createRefreshSalesRollupUseCase`; add two new factories |
| `scripts/schedule-rollup-refresh.bat` | **Move** → `scripts/archived/schedule-rollup-refresh.bat` |

### Shared Code Reused

- `app/(authenticated)/admin/domain/AppSettingsRepository.ts` — existing port; used by both new use cases
- `app/(authenticated)/admin/infrastructure/MySQLAppSettingsRepository.ts` — concrete impl; wired via container
- `container.ts` factories `createGetAppSettingUseCase()` / `createUpdateAppSettingUseCase()` — reused in new factories
- `requireAdmin` helper from `app/(authenticated)/admin/api/rollup/route.ts` — copy pattern to new routes

### DB Tables / Columns

**`app_settings`** (existing key-value table) — two new keys, no schema change:

| Key | Type | Default | Notes |
|---|---|---|---|
| `rollup_trailing_window_days` | string (integer) | `"7"` | Read by rollup refresh at runtime |
| `rollup_run_time` | string (HH:MM) | `"00:00"` | Written only on install/reinstall |

### `container.ts` Factories Added / Changed

| Factory | Change |
|---|---|
| `createRefreshSalesRollupUseCase(windowDays: number)` | Signature change — caller supplies `windowDays` |
| `createGetRollupScheduleStatusUseCase()` | **New** |
| `createInstallRollupScheduleUseCase()` | **New** |

---

## Decisions

**Resolved by AI:**

- **WindowDays as constructor parameter, not repository injection** — `RefreshSalesRollupUseCase` accepts `windowDays: number` instead of injecting `AppSettingsRepository`. Keeps replenishment application layer free of cross-module domain imports; YAGNI (no new abstraction). Callers read the setting via `createGetAppSettingUseCase()` before constructing the use case. Rationale: CLAUDE.md forbids cross-module domain imports without going through `app/shared/`; moving `AppSettingsRepository` to `app/shared/domain/` is over-engineering for one use-case change.

- **`admin/api/rollup/route.ts` (action="refresh") also reads `rollup_trailing_window_days`** — consistency; both the nightly task and manual admin refresh use the same value.

- **Port interface in `admin/application/`** — `TaskSchedulerPort.ts` lives in `application/` per CLAUDE.md: "external service port interfaces" belong in the application layer. The concrete `WindowsTaskSchedulerAdapter` lives in `admin/infrastructure/`. Mirrors the pattern of `SalesRollupRepository` in replenishment.

- **`child_process.exec` (async) for schtasks** — Next.js API routes are async Node.js; using `exec` with a Promise wrapper is non-blocking. `execSync` would stall the server event loop during install (may take ~1s).

- **Task name `"OperationsHub-SalesRollup"`** — PRD-specified; the legacy `.bat` used `"OpsHub-RollupRefresh"`. The two tasks are independent; the legacy task (if registered) is not removed.

- **No new domain entities** — task status is a plain data shape, not a domain entity with behavior. Returned as a plain object from the port.

- **`-o NUL` in curl command** — correct for Windows (discard response body). `NUL` is the Windows null device.

**Assumptions:**

- The Next.js server process has sufficient Windows privileges to run `schtasks /query` (read-only, no privilege required) and `schtasks /create /ru SYSTEM` (requires Administrator). If the server runs as a limited user, Install will fail with a raw OS error displayed inline — this is the documented edge case in the PRD and needs no extra handling.
- `curl` is available on the host (ships with Windows 10/11 build 17063+).
- Encoding: parse `schtasks` output as UTF-8 (`{ encoding: 'utf8' }` in `exec`). Windows schtasks may use system codepage, but UTF-8 is correct for English-locale fields being parsed.

---

## Implementation Steps

### Step 1 — Port interface: `TaskSchedulerPort`

**File:** `app/(authenticated)/admin/application/TaskSchedulerPort.ts` *(new)*

```typescript
export interface TaskSchedulerStatus {
  installed: boolean;
  lastRunAt: string | null;       // ISO datetime string, or null
  lastRunResult: string | null;   // raw result code e.g. "0" or "1"
  nextRunAt: string | null;       // ISO datetime string, or null
}

export interface TaskSchedulerPort {
  queryStatus(taskName: string): Promise<TaskSchedulerStatus>;
  install(taskName: string, runCommand: string, runTime: string): Promise<{ ok: boolean; error?: string }>;
}
```

No existing pattern — first OS-scheduler port in the codebase.

---

### Step 2 — Infrastructure adapter: `WindowsTaskSchedulerAdapter`

**File:** `app/(authenticated)/admin/infrastructure/WindowsTaskSchedulerAdapter.ts` *(new)*

Implements `TaskSchedulerPort`.

**`queryStatus(taskName)`:**
- Runs: `schtasks /query /tn "<taskName>" /fo LIST /v` via `child_process.exec` wrapped in a `Promise`.
- On non-zero exit code or output containing "ERROR: The system cannot find" → return `{ installed: false, lastRunAt: null, lastRunResult: null, nextRunAt: null }`.
- On success: parse LIST output for lines starting with `"Last Run Time:"`, `"Last Result:"`, `"Next Run Time:"`.
  - Field value is everything after the colon, trimmed.
  - `"N/A"` or `"Never"` values → `null`.
  - Valid datetime strings: attempt `new Date(value).toISOString()`; if invalid → keep raw string.
- Return `{ installed: true, lastRunAt, lastRunResult, nextRunAt }`.

**`install(taskName, runCommand, runTime)`:**
- Runs: `schtasks /create /tn "<taskName>" /tr "<runCommand>" /sc DAILY /st <runTime> /ru SYSTEM /f`.
- On non-zero exit code → `{ ok: false, error: stderr string }`.
- On success → `{ ok: true }`.
- Shell-escape `runCommand` by wrapping in double-quotes (the `/tr` value). The curl command has no user-controlled input, so no injection risk.

---

### Step 3 — Use case: `GetRollupScheduleStatusUseCase`

**File:** `app/(authenticated)/admin/application/GetRollupScheduleStatusUseCase.ts` *(new)*

```typescript
export class GetRollupScheduleStatusUseCase {
  constructor(
    private readonly scheduler: TaskSchedulerPort,
    private readonly settings: AppSettingsRepository,
  ) {}

  async execute(): Promise<{
    installed: boolean;
    lastRunAt: string | null;
    lastRunResult: string | null;
    nextRunAt: string | null;
    trailingWindowDays: number;
    runTime: string;
    configError: string | null;
  }> { ... }
}
```

Logic:
1. Read `rollup_trailing_window_days` and `rollup_run_time` from `settings`.
2. Check env vars `NEXTAUTH_URL` and `ROLLUP_REFRESH_TOKEN` — if either is missing/empty, set `configError` to a descriptive string; otherwise `null`.
3. Call `this.scheduler.queryStatus("OperationsHub-SalesRollup")`.
4. Return merged result: task status + settings values (with defaults 7 / `"00:00"`) + `configError`.

Imports: `TaskSchedulerPort` (from same `application/` dir), `AppSettingsRepository` (from `admin/domain/`).

---

### Step 4 — Use case: `InstallRollupScheduleUseCase`

**File:** `app/(authenticated)/admin/application/InstallRollupScheduleUseCase.ts` *(new)*

```typescript
export class InstallRollupScheduleUseCase {
  constructor(
    private readonly scheduler: TaskSchedulerPort,
    private readonly settings: AppSettingsRepository,
  ) {}

  async execute(trailingWindowDays: number, runTime: string): Promise<{ ok: boolean; error?: string }> { ... }
}
```

Logic:
1. Read `NEXTAUTH_URL` and `ROLLUP_REFRESH_TOKEN` from `process.env`; return `{ ok: false, error: "..." }` if either is missing.
2. Save `rollup_trailing_window_days` (as string) and `rollup_run_time` to `settings` atomically via two `set()` calls (`await Promise.all([...])`).
3. Build the curl command: `` `curl -s -o NUL -X POST "${baseUrl}/replenishment/api/rollup/refresh" -H "Authorization: Bearer ${token}"` ``
4. Call `this.scheduler.install("OperationsHub-SalesRollup", curlCmd, runTime)`.
5. Return the scheduler result.

---

### Step 5 — Update `container.ts`

**File:** `container.ts` *(edit)*

Three changes:

**5a.** Change `createRefreshSalesRollupUseCase`:
```typescript
export function createRefreshSalesRollupUseCase(windowDays: number): RefreshSalesRollupUseCase {
  return new RefreshSalesRollupUseCase(new MySQLSalesRollupRepository(), windowDays);
}
```

**5b.** Add:
```typescript
export function createGetRollupScheduleStatusUseCase(): GetRollupScheduleStatusUseCase {
  return new GetRollupScheduleStatusUseCase(
    new WindowsTaskSchedulerAdapter(),
    new MySQLAppSettingsRepository(),
  );
}

export function createInstallRollupScheduleUseCase(): InstallRollupScheduleUseCase {
  return new InstallRollupScheduleUseCase(
    new WindowsTaskSchedulerAdapter(),
    new MySQLAppSettingsRepository(),
  );
}
```

Add imports for `WindowsTaskSchedulerAdapter`, `GetRollupScheduleStatusUseCase`, `InstallRollupScheduleUseCase` at the top of `container.ts`.

---

### Step 6 — Update `RefreshSalesRollupUseCase`

**File:** `app/(authenticated)/replenishment/application/RefreshSalesRollupUseCase.ts` *(edit)*

- Remove `private static readonly TRAILING_WINDOW_DAYS = 7`.
- Add `windowDays: number` as a second constructor parameter.
- Use `this.windowDays` in `execute()` where `TRAILING_WINDOW_DAYS` was used.

Mirrors: `RebuildSalesRollupUseCase` is the analogous use case in the same directory.

---

### Step 7 — Update callers of `createRefreshSalesRollupUseCase`

Both routes that call the refresh use case must now read `rollup_trailing_window_days` from `app_settings` before constructing the use case.

**7a. `app/(authenticated)/replenishment/api/rollup/refresh/route.ts`** *(edit)*

In `POST`:
```typescript
const windowDaysRaw = await createGetAppSettingUseCase().execute("rollup_trailing_window_days");
const windowDays = Math.max(1, Math.min(30, parseInt(windowDaysRaw ?? "7", 10) || 7));
const result = await createRefreshSalesRollupUseCase(windowDays).execute();
```

**7b. `app/(authenticated)/admin/api/rollup/route.ts`** *(edit)*

In `POST`, inside the `action === "refresh"` branch:
```typescript
const windowDaysRaw = await createGetAppSettingUseCase().execute("rollup_trailing_window_days");
const windowDays = Math.max(1, Math.min(30, parseInt(windowDaysRaw ?? "7", 10) || 7));
const result = await createRefreshSalesRollupUseCase(windowDays).execute();
```

The `action === "rebuild"` branch calls `createRebuildSalesRollupUseCase()` — unaffected (rebuild always reprocesses all 13 months, no window config).

---

### Step 8 — New API route: `GET /admin/api/rollup-schedule`

**File:** `app/(authenticated)/admin/api/rollup-schedule/route.ts` *(new)*

```typescript
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const status = await createGetRollupScheduleStatusUseCase().execute();
  return NextResponse.json(status);
}
```

Response shape matches PRD §7. `requireAdmin` imported using the same pattern as `app/(authenticated)/admin/api/rollup/route.ts`.

---

### Step 9 — New API route: `POST /admin/api/rollup-schedule/install`

**File:** `app/(authenticated)/admin/api/rollup-schedule/install/route.ts` *(new)*

```typescript
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({})) as { trailingWindowDays?: number; runTime?: string };
  const { trailingWindowDays, runTime } = body;
  if (
    typeof trailingWindowDays !== "number" || trailingWindowDays < 1 || trailingWindowDays > 30 ||
    typeof runTime !== "string" || !/^\d{2}:\d{2}$/.test(runTime)
  ) {
    return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });
  }
  const result = await createInstallRollupScheduleUseCase().execute(trailingWindowDays, runTime);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
```

---

### Step 10 — Update `admin/page.tsx` — Task Scheduler section

**File:** `app/(authenticated)/admin/page.tsx` *(edit)*

Inside the `<TabsContent value="rollup">` section, after the existing "Actions" card, add a new card:

**State added to component:**
```typescript
// Task Scheduler state
const [scheduleStatus, setScheduleStatus] = useState<ScheduleStatus | null>(null);
const [scheduleLoading, setScheduleLoading] = useState(false);
const [trailingWindowDays, setTrailingWindowDays] = useState(7);
const [runTime, setRunTime] = useState("00:00");
const [scheduleInstalling, setScheduleInstalling] = useState(false);
const [scheduleError, setScheduleError] = useState<string | null>(null);
```

Define `ScheduleStatus` interface inline (matching API response from §7 of PRD) — same pattern as existing `RollupHealth` interface defined inside `Page`.

**Load on tab click:** The existing `onClick={loadRollupHealth}` on the tab trigger is changed to also call `loadScheduleStatus()`. Define `loadScheduleStatus` alongside `loadRollupHealth`:
```typescript
const loadScheduleStatus = useCallback(() => {
  setScheduleLoading(true);
  fetch("/admin/api/rollup-schedule")
    .then((r) => r.json())
    .then((data: ScheduleStatus) => {
      setScheduleStatus(data);
      setTrailingWindowDays(data.trailingWindowDays);
      setRunTime(data.runTime);
    })
    .finally(() => setScheduleLoading(false));
}, []);
```

**Install handler:**
```typescript
async function installRollupSchedule() {
  setScheduleInstalling(true);
  setScheduleError(null);
  try {
    const res = await fetch("/admin/api/rollup-schedule/install", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trailingWindowDays, runTime }),
    });
    const data = await res.json() as { ok: boolean; error?: string };
    if (data.ok) {
      // show success toast — reuse rollupMessage pattern or add scheduleMessage state
      loadScheduleStatus(); // re-fetch to update installed/next run
    } else {
      setScheduleError(data.error ?? "Installation failed.");
    }
  } catch {
    setScheduleError("Network error. Please try again.");
  } finally {
    setScheduleInstalling(false);
  }
}
```

**UI card layout (inside the rollup TabsContent, below Actions card):**

```
<Card p-4 space-y-4>
  <h3>Task Scheduler</h3>

  {configError && <amber warning banner text={configError} />}

  {/* Status row */}
  <dl grid>
    <dt>Status</dt>  <dd>Badge: Installed / Not Installed</dd>
    if installed:
    <dt>Last Run</dt>  <dd>{lastRunAt ?? "Never"} (result: {lastRunResult})</dd>
    <dt>Next Run</dt>  <dd>{nextRunAt ?? "N/A"}</dd>
  </dl>

  {/* Config fields */}
  <Label>Trailing window (days)</Label>
  <Input type="number" min=1 max=30 value={trailingWindowDays} ... />

  <Label>Nightly run time</Label>
  <Input type="time" value={runTime} ... />

  <Button disabled={!!configError || scheduleInstalling || !validDays}>
    {installed ? (scheduleInstalling ? "Reinstalling…" : "Reinstall") 
               : (scheduleInstalling ? "Installing…"  : "Install")}
  </Button>

  {scheduleError && <p text-destructive>{scheduleError}</p>}
</Card>
```

Client-side validation: `validDays = Number.isInteger(trailingWindowDays) && trailingWindowDays >= 1 && trailingWindowDays <= 30`.

Success toast: add `scheduleMessage` state (`{ type: "success" | "error"; text: string } | null`) following the same pattern as `rollupMessage`; clear after 4000ms on success.

---

### Step 11 — Move legacy `.bat` script

Move `scripts/schedule-rollup-refresh.bat` → `scripts/archived/schedule-rollup-refresh.bat`.

Create `scripts/archived/` directory first if it doesn't exist. No content change to the file.

---

## Risks & Open Questions

| Risk | Notes |
|---|---|
| **`schtasks /create /ru SYSTEM` requires Administrator** | The Next.js server process must be running as an Administrator (or have SeCreatePermanentPrivilege). If not, Install returns a raw OS error. Documented in PRD edge cases; no extra handling needed in code. Worth verifying in the target deployment environment. |
| **schtasks output encoding** | On Windows, `schtasks /fo LIST` output encoding depends on the system locale. Parsing with `{ encoding: 'utf8' }` is correct for en-US locales; other locales may produce garbled field labels. If the deployment locale differs from en-US, field label parsing may need a fallback (regex on known labels). |
| **"N/A" vs "Never" vs blank in schtasks output** | The "Last Run Time" field shows `"N/A"` when the task has never run. `"Next Run Time"` may show a datetime or `"N/A"` if disabled. The adapter must handle all three forms (`null` output). |
| **Task name change** | Legacy `.bat` registered `"OpsHub-RollupRefresh"`; new installs create `"OperationsHub-SalesRollup"`. If the old task exists, it continues to run. Admins may need to manually delete it (`schtasks /delete /tn "OpsHub-RollupRefresh" /f`) — no UI action provided (non-goal). |
| **`RefreshSalesRollupUseCase` constructor signature change** | Both call sites (`replenishment/api/rollup/refresh/route.ts` and `admin/api/rollup/route.ts`) call the container factory — updating the factory signature propagates cleanly. No direct instantiation anywhere else (container.ts is the single wiring point). |
