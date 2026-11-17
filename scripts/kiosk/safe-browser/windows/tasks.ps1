# Registers BNG Safe Browser scheduled tasks (run by the installer as administrator).
#  - "BNG Safe Browser Update": SYSTEM, at startup and every 3 hours -> SafeBrowser.exe --update
#    (checks the GitHub release, verifies SHA-256, installs silently; no UAC for student accounts)
#  - "BNG Safe Browser Relaunch": runs SafeBrowser.exe in the signed-in user's session after an update
param([string]$App, [switch]$Remove)
$ErrorActionPreference = "SilentlyContinue"
Unregister-ScheduledTask -TaskName "BNG Safe Browser Update" -Confirm:$false
Unregister-ScheduledTask -TaskName "BNG Safe Browser Relaunch" -Confirm:$false
if ($Remove) { exit 0 }
$exe = Join-Path $App "SafeBrowser.exe"
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
$boot = New-ScheduledTaskTrigger -AtStartup
$boot.Delay = "PT3M"
$every = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(10) -RepetitionInterval (New-TimeSpan -Hours 3)
Register-ScheduledTask -TaskName "BNG Safe Browser Update" -Action (New-ScheduledTaskAction -Execute $exe -Argument "--update" -WorkingDirectory $App) `
  -Trigger @($boot, $every) -Principal (New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest) -Settings $settings | Out-Null
Register-ScheduledTask -TaskName "BNG Safe Browser Relaunch" -Action (New-ScheduledTaskAction -Execute $exe -WorkingDirectory $App) `
  -Principal (New-ScheduledTaskPrincipal -GroupId "S-1-5-32-545" -RunLevel Limited) -Settings $settings | Out-Null
