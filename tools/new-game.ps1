<#
.SYNOPSIS
  Creates a new game project from the web-2d-games branch of this base repository.

.DESCRIPTION
  Clones the web-2d-games branch into a new folder, renames the branch to main, keeps this base
  as the "base" remote (pull updates with: git fetch base; git merge base/web-2d-games) and,
  if -RemoteUrl is given, adds the game's own GitHub repository as "origin" and pushes.
  The empty GitHub repository must be created first (no README, no .gitignore).

.EXAMPLE
  ./tools/new-game.ps1 space-dodge
.EXAMPLE
  ./tools/new-game.ps1 space-dodge -RemoteUrl https://github.com/<user>/space-dodge.git
#>
param(
  [Parameter(Mandatory = $true)][ValidatePattern('^[a-z0-9][a-z0-9-]*$')][string]$Name,
  [string]$RemoteUrl = '',
  [string]$ParentDir = '',
  [string]$BaseUrl = '',
  [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
if (-not $ParentDir) { $ParentDir = Split-Path -Parent $repoRoot }
if (-not $BaseUrl) { $BaseUrl = (git -C $repoRoot remote get-url origin).Trim() }
$target = Join-Path $ParentDir $Name

if (Test-Path $target) { throw "Folder already exists: $target" }

function Invoke-Git {
  git @args
  if ($LASTEXITCODE -ne 0) { throw "git $($args -join ' ') failed" }
}

Write-Host "Cloning $BaseUrl (web-2d-games) into $target"
Invoke-Git clone -q -b web-2d-games --single-branch $BaseUrl $target
Push-Location $target
try {
  Invoke-Git branch -m web-2d-games main
  Invoke-Git remote rename origin base
  if ($RemoteUrl) {
    Invoke-Git remote add origin $RemoteUrl
    Invoke-Git push -u origin main
  }
  if (-not $SkipInstall) {
    npm install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'npm install failed' }
  }
} finally {
  Pop-Location
}

Write-Host ""
Write-Host "Done: $target"
if (-not $RemoteUrl) { Write-Host "Add the game's GitHub repo later: git remote add origin <url>; git push -u origin main" }
Write-Host "Next: open the folder in VS Code and ask Claude for the game (the new-2d-game skill scaffolds it)."
