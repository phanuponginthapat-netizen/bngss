# BNG FaceGate - one-time Windows kiosk tuning (always on AC power).
# Safe to re-run. Every step is independent; failures are reported, never fatal.
$ErrorActionPreference = "Continue"
$log = Join-Path $env:ProgramData "BNG FaceGate\optimize.log"
New-Item -ItemType Directory -Force -Path (Split-Path $log) | Out-Null
function Step($name, [scriptblock]$b) {
  try { & $b *> $null; Add-Content $log "OK   $name" } catch { Add-Content $log "FAIL $name : $_" }
}
Add-Content $log "=== $(Get-Date -Format s) ==="
# Power: High Performance, never sleep on AC, no hibernate file, lid/power button do nothing
Step "high-performance" { powercfg -setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c }
Step "no-sleep-ac"      { powercfg -change -standby-timeout-ac 0; powercfg -change -monitor-timeout-ac 0; powercfg -change -disk-timeout-ac 0 }
Step "hibernate-off"    { powercfg -h off }
Step "lid-nothing"      { powercfg -setacvalueindex SCHEME_CURRENT SUB_BUTTONS LIDACTION 0 }
Step "power-btn-nothing"{ powercfg -setacvalueindex SCHEME_CURRENT SUB_BUTTONS PBUTTONACTION 0 }
Step "usb-no-suspend"   { powercfg -setacvalueindex SCHEME_CURRENT 2a737441-1930-4402-8d77-b2bebba308a3 48e6b7a6-50f5-4782-a5d4-53bb8f07e226 0 }
# 99% max CPU disables turbo: avoids thermal throttling on fanless Atom tablets
Step "cpu-99"           { powercfg -setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PROCTHROTTLEMAX 99; powercfg -setacvalueindex SCHEME_CURRENT SUB_PROCESSOR PROCTHROTTLEMIN 50 }
Step "apply-scheme"     { powercfg -setactive SCHEME_CURRENT }
# Background disk/CPU load on eMMC
foreach ($s in "SysMain","DiagTrack","WSearch") {
  Step "svc-$s" { Stop-Service $s -Force -ErrorAction Stop; Set-Service $s -StartupType Disabled -ErrorAction Stop }
}
# Visual effects: best performance (all users default + current user)
Step "visual-fx" {
  $k = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects"
  New-Item $k -Force | Out-Null; Set-ItemProperty $k VisualFXSetting 2 -Type DWord
  Set-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize" EnableTransparency 0 -Type DWord
}
# No background apps, tips, or notification popups covering the scanner
Step "no-bg-apps" {
  $k = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\AppPrivacy"; New-Item $k -Force | Out-Null
  Set-ItemProperty $k LetAppsRunInBackground 2 -Type DWord
}
Step "no-tips" {
  $k = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\CloudContent"; New-Item $k -Force | Out-Null
  Set-ItemProperty $k DisableWindowsConsumerFeatures 1 -Type DWord; Set-ItemProperty $k DisableSoftLanding 1 -Type DWord
}
Step "no-toasts" {
  $k = "HKCU:\Software\Microsoft\Windows\CurrentVersion\PushNotifications"; New-Item $k -Force | Out-Null
  Set-ItemProperty $k ToastEnabled 0 -Type DWord
}
# Windows Update: never auto-restart while someone is signed in; school hours active
Step "wu-no-reboot" {
  $k = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU"; New-Item $k -Force | Out-Null
  Set-ItemProperty $k NoAutoRebootWithLoggedOnUsers 1 -Type DWord
  $u = "HKLM:\SOFTWARE\Microsoft\WindowsUpdate\UX\Settings"; New-Item $u -Force | Out-Null
  Set-ItemProperty $u ActiveHoursStart 6 -Type DWord; Set-ItemProperty $u ActiveHoursEnd 18 -Type DWord
}
Add-Content $log "Battery charge limit (80%) must be set in BIOS (F10 > Battery Health Manager)."
