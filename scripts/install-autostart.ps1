$ErrorActionPreference = 'Stop'
$taskName = 'MCQ Video Studio Local'
$launcherPath = (Resolve-Path (Join-Path $PSScriptRoot 'start-project.ps1')).Path
$powerShellPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$action = New-ScheduledTaskAction -Execute $powerShellPath -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$launcherPath`"" -WorkingDirectory (Split-Path -Parent $PSScriptRoot)
$trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description 'Start the local MCQ Video Studio when this Windows account signs in.' -Force | Out-Null
Write-Output 'Startup is enabled. The project will start and open http://localhost:5173/ when you sign in to Windows.'
