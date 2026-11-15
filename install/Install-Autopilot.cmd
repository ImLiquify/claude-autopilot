@echo off
rem Autopilot installer for Windows: double-click it. It installs the version below into Claude Code
rem (or switches to it from the one you have), then asks you to restart Claude. "latest" means the newest.
set "AP_VERSION=latest"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s = Get-Content -LiteralPath '%~f0' -Raw; Invoke-Expression ($s.Substring($s.IndexOf('#PS' + 'START') + 8))"
echo.
pause
exit /b

#PSSTART
$ErrorActionPreference = 'Stop'
$v = $env:AP_VERSION
$repo = 'ImLiquify/claude-autopilot'
Write-Host "Installing Autopilot $v ..."
if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
  Write-Host 'Claude Code is not installed: the claude command was not found. Install it from https://claude.com/claude-code, then run this again.'
  return
}
$tag = if ($v -eq 'latest') { '' } else { "v$v" }
# A copy installed before is declared in settings.json: point it at this version (a backup is kept next to it).
$cfg = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $HOME '.claude' }
$file = Join-Path $cfg 'settings.json'
$changed = $false
if (Test-Path -LiteralPath $file) {
  $s = [IO.File]::ReadAllText($file)
  $ref = if ($tag) { ", ""ref"": ""$tag""" } else { '' }
  $new = [regex]::Replace($s, '("autopilot"\s*:\s*\{\s*"source"\s*:\s*)\{[^{}]*\}', { param($m) $m.Groups[1].Value + "{ ""source"": ""github"", ""repo"": ""$repo""$ref }" })
  if ($new -ne $s) { Copy-Item -LiteralPath $file "$file.bak" -Force; [IO.File]::WriteAllText($file, $new); $changed = $true }
}
$src = if ($tag) { "$repo#$tag" } else { $repo }
& claude plugin marketplace add $src
if ($LASTEXITCODE -ne 0) {
  if ($changed) { Copy-Item -LiteralPath "$file.bak" $file -Force } # nothing changed: the version you had stays
  Write-Host "Could not add Autopilot $v. Check that the version exists: https://github.com/$repo/releases"
  return
}
& claude plugin marketplace update autopilot
& claude plugin install autopilot@autopilot
& claude plugin update autopilot@autopilot
Write-Host ''
Write-Host "$(if ($tag) { "Autopilot $v" } else { 'The newest Autopilot' }) is installed. Restart Claude to start using it."
