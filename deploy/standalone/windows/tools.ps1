# เครื่องมือใน Start Menu: open | backup | restore | update | make-admin | keys
param([Parameter(Mandatory=$true)][string]$Action)
$repo = (Resolve-Path "$PSScriptRoot\..\..\..").Path
$wslRepo = (wsl -d Ubuntu wslpath -a ($repo -replace '\\','/')).Trim()
switch ($Action) {
  "open"    { $ip = (Get-Content "$env:ProgramData\SchoolSystem\server-ip.txt" -ErrorAction SilentlyContinue); if (-not $ip) { $ip = "localhost" }; Start-Process "http://$ip" }
  "backup"  { wsl -d Ubuntu -u root -- /usr/local/bin/school-backup; Read-Host "สำรองข้อมูลเสร็จ กด Enter" }
  "restore" { wsl -d Ubuntu -u root -- /usr/local/bin/school-restore; Read-Host "กด Enter" }
  "update"  { wsl -d Ubuntu -u root -- /usr/local/bin/school-update; Read-Host "กด Enter" }
  "keys"    { Write-Host "ใส่กุญแจบริการ (LINE / AI / Google) — กด Enter เพื่อข้าม"; wsl -d Ubuntu -u root -- /usr/local/bin/school-set-keys; Read-Host "กด Enter" }
  "make-admin" { $e = Read-Host "อีเมลผู้ดูแลระบบ"; wsl -d Ubuntu -u root -- bash "$wslRepo/deploy/standalone/make-admin.sh" $e; Read-Host "กด Enter" }
}
