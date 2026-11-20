$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$pidFile = Join-Path $projectRoot 'storage\logs\project-dev.json'

if (-not (Test-Path -LiteralPath $pidFile)) {
  Write-Output 'The project is not running from the desktop launcher.'
  exit 0
}

$savedProcess = Get-Content -LiteralPath $pidFile -Raw | ConvertFrom-Json
$process = Get-Process -Id ([int]$savedProcess.processId) -ErrorAction SilentlyContinue
if ($process -and $process.StartTime.ToUniversalTime().Ticks -eq [long]$savedProcess.startedAtTicks) {
  & taskkill.exe /PID $process.Id /T /F | Out-Null
  Write-Output 'The local website has been stopped.'
} else {
  Write-Output 'The launcher process has already stopped.'
}
Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
