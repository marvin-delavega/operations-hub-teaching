@echo off
REM ============================================================================
REM  start-app.bat
REM  Scheduled-task entrypoint for the Operations Hub app server. Runs from the
REM  installed app directory. Deps + production build are done at install time
REM  by install-app-deps.ps1; this only serves the already-built app so boots
REM  are fast. Deps (node_modules) must therefore already be present.
REM ============================================================================
setlocal
cd /d "%~dp0.."

REM Use the local node_modules' next if present, else rely on PATH for node.
call npm run start

REM Surface the exit code so Task Scheduler / an operator can see a failure.
exit /b %ERRORLEVEL%
