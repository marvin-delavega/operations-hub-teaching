[Setup]
; Operations Hub installer — ships only the required files staged by
; scripts/pack-release.ps1. Compile with Inno Setup 7 (ISCC.exe):
;   iscc /DAppVersion=1.0.0 installer\OperationsHub.iss
; The output is a single OperationsHub-Setup-<version>.exe. AppVersion is passed
; from package.json by scripts\compile-installer.ps1 (do not edit here).

#ifndef AppVersion
#define AppVersion "0.0.0"
#endif

AppId={{8F3C1A2B-0D42-4A1E-9B7A-5E21C6D4F8A0}
AppName=Operations Hub
AppVersion={#AppVersion}
AppVerName=Operations Hub {#AppVersion}
AppPublisher=Davao Great Wall Trading
DefaultDirName={localappdata}\OperationsHub
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=..\dist
OutputBaseFilename=OperationsHub-Setup-{#AppVersion}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayName=Operations Hub

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "scheduledtask"; Description: "Start Operations Hub automatically at logon"; Flags: checkedonce

[Files]
; Ship the staged required files from ..\staging. Runtime config (.env.local,
; data\db-config.json) is intentionally NOT staged, so a swap-in-place update
; never clobbers the running DB connection or secrets. data\ is shipped empty.
Source: "..\staging\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

; The runtime data dir is excluded from overwrite concerns; keep it but mark it.
[Dirs]
Name: "{app}\data"

[Run]
; 1) Install deps + build on the target (requires Node on PATH).
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\install-app-deps.ps1"""; StatusMsg: "Installing dependencies and building..."; Flags: runhidden waituntilterminated
; 2) Register the boot/logon scheduled task (Task selected above).
Filename: "{app}\scripts\register-app-task.bat"; Parameters: """{app}"""; StatusMsg: "Registering start-at-logon task..."; Flags: runhidden waituntilterminated runascurrentuser; Tasks: scheduledtask

[UninstallRun]
; Remove the scheduled task so an uninstall doesn't orphan a task pointing at a
; missing app. Runtime config (data\.env.local) is left on disk intentionally.
Filename: "schtasks.exe"; Parameters: "/delete /tn ""OpsHub-App"" /f"; Flags: runhidden; RunOnceId: "RemoveOpsHubTask"
