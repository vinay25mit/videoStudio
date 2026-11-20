$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$logDirectory = Join-Path $projectRoot 'storage\logs'
$pidFile = Join-Path $logDirectory 'project-dev.json'
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null

function Test-ProjectReady {
  try {
    $api = Invoke-WebRequest -Uri 'http://localhost:5000/api/health' -TimeoutSec 2 -UseBasicParsing
    $web = Invoke-WebRequest -Uri 'http://localhost:5173/' -TimeoutSec 2 -UseBasicParsing
    return $api.StatusCode -eq 200 -and $web.StatusCode -eq 200
  } catch {
    return $false
  }
}

$devProcess = $null
if (-not (Test-ProjectReady)) {
  if (-not (Test-Path (Join-Path $projectRoot 'node_modules'))) {
    throw 'Project dependencies are missing. Run npm install in the project folder first.'
  }

  $devProcess = Start-Process -FilePath $env:ComSpec `
    -ArgumentList @('/c', 'npm run dev') `
    -WorkingDirectory $projectRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logDirectory 'project-dev.log') `
    -RedirectStandardError (Join-Path $logDirectory 'project-dev-error.log') `
    -PassThru
  @{ processId = $devProcess.Id; startedAtTicks = $devProcess.StartTime.ToUniversalTime().Ticks } |
    ConvertTo-Json | Set-Content -LiteralPath $pidFile -Encoding UTF8

  $ready = $false
  for ($attempt = 0; $attempt -lt 90; $attempt += 1) {
    if (Test-ProjectReady) {
      $ready = $true
      break
    }
    $devProcess.Refresh()
    if ($devProcess.HasExited) { break }
    Start-Sleep -Seconds 1
  }

  if (-not $ready) {
    if (-not $devProcess.HasExited) { Stop-Process -Id $devProcess.Id -Force -ErrorAction SilentlyContinue }
    Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
    throw "The project did not start. Check $logDirectory for startup logs."
  }
}

Start-Process 'http://localhost:5173/'

if ($devProcess) {
  while ($true) {
    Start-Sleep -Seconds 5
    $devProcess.Refresh()
    if ($devProcess.HasExited) { break }
  }
  Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
}
