# เครื่องมือใน Start Menu: open | backup | restore | update | make-admin
param([Parameter(Mandatory=$true)][string]$Action)
$repo = (Resolve-Path "$PSScriptRoot\..\..\..").Path
$wslRepo = (wsl wslpath -a ($repo -replace '\\','/')).Trim()
switch ($Action) {
  "open"    { $ip = (Get-Content "$env:ProgramData\SchoolSystem\server-ip.txt" -ErrorAction SilentlyContinue); if (-not $ip) { $ip = "localhost" }; Start-Process "http://$ip" }
  "backup"  { wsl -u root -- /usr/local/bin/school-backup; Read-Host "สำรองข้อมูลเสร็จ กด Enter" }
  "restore" { wsl -u root -- /usr/local/bin/school-restore; Read-Host "กด Enter" }
  "update"  { wsl -u root -- /usr/local/bin/school-update; Read-Host "กด Enter" }
  "make-admin" { $e = Read-Host "อีเมลผู้ดูแลระบบ"; wsl -u root -- bash "$wslRepo/deploy/standalone/make-admin.sh" $e; Read-Host "กด Enter" }
}
