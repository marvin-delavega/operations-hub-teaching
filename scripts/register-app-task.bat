@echo off
REM ============================================================================
REM  register-app-task.bat <APP_DIR>
REM  Registers the boot/logon scheduled task that starts the Operations Hub app
REM  server. Called from the installer after files + deps are in place, with the
REM  install directory passed as %1 (Inno supplies its {app} constant).
REM ============================================================================
if "%~1"=="" (
  echo Usage: register-app-task.bat ^<APP_DIR^>
  exit /b 1
)
set "APP_DIR=%~1"

schtasks /create ^
  /tn "OpsHub-App" ^
  /tr "\"%APP_DIR%\scripts\start-app.bat\"" ^
  /sc ONLOGON ^
  /rl LIMITED ^
  /f

IF %ERRORLEVEL% EQU 0 (
  echo Task "OpsHub-App" registered. It will start the app at logon.
) ELSE (
  echo ERROR: Failed to register "OpsHub-App". Run the installer as the user who
  echo will log on, or check schtasks permissions.
)
exit /b %ERRORLEVEL%
