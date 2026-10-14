# ============================================================================
#  pack-release.ps1
#  Builds the release staging folder that installer/OperationsHub.iss ships.
#
#  Usage:  powershell -ExecutionPolicy Bypass -File scripts\pack-release.ps1
#
#  Copies ONLY the files required to build + run Operations Hub on the target
#  (source minus regenerables/local state), mirroring .gitignore. The staging
#  folder is what Inno Setup's [Files] section consumes, so "what ships" is
#  decided here — not by hand-editing the .iss file list.
#  Regenerables excluded: node_modules, .next, .env*, data/db-config.json.
#  Runtime state (data/ dir) is created empty so the UI can write its config.
# ============================================================================
param(
    [string]$OutDir = "$PSScriptRoot\..\staging"
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path "$PSScriptRoot\.."

if (Test-Path $OutDir) {
    Remove-Item -Recurse -Force $OutDir
}
New-Item -ItemType Directory -Path $OutDir -Force | Out-Null

# Explicit required file/dir set (relative to repo root). Keeping an allow-list
# instead of a deny-list means a stray dev file can never leak into the package.
$required = @(
    "app",
    "src",
    "middleware.ts",
    "next.config.ts",
    "postcss.config.mjs",
    "components.json",
    "tsconfig.json",
    "eslint.config.mjs",
    "package.json",
    "package-lock.json"
)

# public/ may not exist yet in some checkouts; ship it only if present.
if (Test-Path "$root\public") { $required += "public" }

foreach ($entry in $required) {
    $src = Join-Path $root $entry
    if (-not (Test-Path $src)) {
        throw "Required path missing from repo root: $entry"
    }
    Copy-Item -Recurse -Path $src -Destination $OutDir
}

# Create an empty data/ dir so dbConfig writeFileConfig() has a home on first
# run. It must stay OUT of the installer's overwrite protection list concern:
# we ship it empty and never stage db-config.json.
New-Item -ItemType Directory -Path "$OutDir\data" -Force | Out-Null

$appVersion = (Get-Content (Join-Path $root "package.json") -Raw | ConvertFrom-Json).version
Write-Host "Staged release files to: $OutDir"
Write-Host "App version staged:      $appVersion"
