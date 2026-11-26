# Publishes this project to GitHub.
#
# Before running:
#   1. Go to https://github.com/new
#   2. Name it (e.g. zenaa-socials), choose Private or Public,
#      and DO NOT tick "Add a README" (the repo must be empty).
#   3. Copy the repo URL, e.g. https://github.com/YOUR-USERNAME/zenaa-socials.git
#
# Then run in PowerShell from this folder:
#   powershell -ExecutionPolicy Bypass -File .\publish-to-github.ps1 -RepoUrl https://github.com/YOUR-USERNAME/zenaa-socials.git
#
# Running it again later pushes any new changes.

param(
  [Parameter(Mandatory = $true)][string]$RepoUrl,
  [string]$Message = "Update site"
)

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

function Invoke-Git { & git @args; if ($LASTEXITCODE -ne 0) { throw "git $args failed" } }

# Git needs a name and email to label commits.
if (-not (git config user.name))  { git config --global user.name  (Read-Host 'Your name for git commits') }
if (-not (git config user.email)) { git config --global user.email (Read-Host 'Your GitHub email') }

if (-not (Test-Path .git)) {
  Invoke-Git init -b main
  $Message = "Initial commit: Zenaa socials link page"
}

if (git remote | Select-String -Quiet '^origin$') { Invoke-Git remote set-url origin $RepoUrl }
else { Invoke-Git remote add origin $RepoUrl }

# Never upload secrets.
if (git ls-files .env) { Invoke-Git rm --cached .env }

Invoke-Git add -A
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) { Invoke-Git commit -m $Message } else { Write-Host 'No new changes to commit.' }

Write-Host 'Pushing to GitHub (a browser sign-in window may open the first time)...'
Invoke-Git push -u origin main
Write-Host "`nDone! Your code is at: $($RepoUrl -replace '\.git$','')" -ForegroundColor Green
