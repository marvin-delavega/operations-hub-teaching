# ============================================================================
#  compile-installer.ps1
#  Updates version from latest Git tag, stages release files, then compiles 
#  the Inno Setup installer.
#
#  Prerequisite: Inno Setup 7 (ISCC.exe) installed on the build machine.
#
#  Usage:
#    powershell -ExecutionPolicy Bypass -File scripts\compile-installer.ps1
#
#  Steps: Git tag update -> pack-release.ps1 (stage) -> find ISCC -> iscc.
#  Output: dist\OperationsHub-Setup-<version>.exe
# ============================================================================
param(
    [string]$IsccPath = ""
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path "$PSScriptRoot\.."

# --- Step: Update package.json version based on latest Git tag --------------
Write-Host "==> Fetching latest Git tag and updating package.json..." -ForegroundColor Cyan

# Get the latest tag and strip the leading 'v' if present
$latestTag = (git describe --tags --abbrev=0) -replace '^v', ''

if (-not $latestTag) {
    throw "No Git tags found. Cannot determine version."
}

Write-Host "Latest Git tag found: $latestTag"

# Load, update, and save package.json
$pkgPath = Join-Path $root "package.json"
$pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
$pkg.version = $latestTag
$pkg | ConvertTo-Json -Depth 10 | Set-Content $pkgPath

# --- Staging release files --------------------------------------------------
Write-Host "==> Staging release files..." -ForegroundColor Cyan
& (Join-Path $PSScriptRoot "pack-release.ps1")

# --- Locate Inno Setup compiler --------------------------------------------
if (-not $IsccPath) {
    $candidates = @(
        "$env:ProgramFiles(x86)\Inno Setup 7\ISCC.exe",
        "$env:ProgramFiles\Inno Setup 7\ISCC.exe",
        (Get-Command iscc -ErrorAction SilentlyContinue).Source
    ) | Where-Object { $_ -and (Test-Path $_) }
    if ($candidates) { $IsccPath = $candidates | Select-Object -First 1 }
}
if (-not $IsccPath) {
    throw "ISCC.exe not found. Install Inno Setup 7 or pass -IsccPath ""C:\...\ISCC.exe""."
}

$version = (Get-Content (Join-Path $root "package.json") -Raw | ConvertFrom-Json).version
$iss = Join-Path $root "installer\OperationsHub.iss"

Write-Host "==> Compiling installer v$version with $IsccPath ..." -ForegroundColor Cyan
& $IsccPath "/DAppVersion=$version" $iss
if ($LASTEXITCODE -ne 0) { throw "ISCC compile failed (exit $LASTEXITCODE)." }

Write-Host "==> Done. Installer written to $root\dist\OperationsHub-Setup-$version.exe" -ForegroundColor Green
