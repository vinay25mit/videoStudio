$taskName = 'MCQ Video Studio Local'
$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($task) {
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
  Write-Output 'Startup is disabled. The project will no longer start when you sign in.'
} else {
  Write-Output 'The project startup task was not installed.'
}
