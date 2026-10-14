@echo off
REM ============================================================================
REM  Register the nightly sales-rollup refresh as a Windows Task Scheduler job.
REM
REM  Prerequisites:
REM    1. Set APP_BASE_URL and ROLLUP_REFRESH_TOKEN below (or pass as env vars).
REM    2. Run this script once from an elevated (Administrator) command prompt.
REM    3. The task will run daily at 02:00 under the SYSTEM account.
REM
REM  To verify:   schtasks /query /tn "OpsHub-RollupRefresh"
REM  To remove:   schtasks /delete /tn "OpsHub-RollupRefresh" /f
REM ============================================================================

REM ── Configuration ────────────────────────────────────────────────────────────
REM Set these to match your deployment. Wrap values in quotes if they contain spaces.

SET APP_BASE_URL=http://localhost:3000
SET ROLLUP_REFRESH_TOKEN=CHANGE_ME

REM ── Build the curl command ───────────────────────────────────────────────────
REM Uses curl (ships with Windows 10/11). Sends a POST with Bearer auth.

SET TASK_CMD=curl -s -o NUL -w "%%{http_code}" -X POST "%APP_BASE_URL%/replenishment/api/rollup/refresh" -H "Authorization: Bearer %ROLLUP_REFRESH_TOKEN%"

REM ── Register (or update) the scheduled task ──────────────────────────────────
schtasks /create ^
  /tn "OpsHub-RollupRefresh" ^
  /tr "%TASK_CMD%" ^
  /sc DAILY ^
  /st 02:00 ^
  /ru SYSTEM ^
  /f

IF %ERRORLEVEL% EQU 0 (
  echo.
  echo Task "OpsHub-RollupRefresh" registered successfully.
  echo It will run daily at 02:00 under the SYSTEM account.
  echo.
  echo Verify with:  schtasks /query /tn "OpsHub-RollupRefresh"
) ELSE (
  echo.
  echo ERROR: Failed to register the scheduled task. Run as Administrator.
)
