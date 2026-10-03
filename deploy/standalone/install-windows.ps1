# ติดตั้งแบบ Standalone บน Windows 10/11 (คลิกขวา > Run with PowerShell ในฐานะ Administrator)
# ใช้ WSL2 + Docker Desktop แล้วเรียก install.sh ตัวเดียวกับ Linux
$ErrorActionPreference = "Stop"
if (-not (wsl -l -q 2>$null)) { wsl --install -d Ubuntu; Write-Host "รีสตาร์ทเครื่องแล้วรันสคริปต์นี้อีกครั้ง"; exit }
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  winget install -e --id Docker.DockerDesktop --accept-source-agreements --accept-package-agreements
  Write-Host "เปิด Docker Desktop (เปิด WSL integration) แล้วรันสคริปต์นี้อีกครั้ง"; exit
}
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.PrefixOrigin -eq "Dhcp" -or $_.PrefixOrigin -eq "Manual" } | Where-Object { $_.IPAddress -notlike "169.*" -and $_.IPAddress -ne "127.0.0.1" } | Select-Object -First 1).IPAddress
$mode = Read-Host "เลือกแบบ: 1 = ใช้ในโรงเรียนอย่างเดียว, 2 = แบบผสม (สำรองขึ้น Cloud)"
$flag = if ($mode -eq "2") { "--hybrid" } else { "" }
$repo = (Resolve-Path "$PSScriptRoot\..\..").Path
$wslRepo = (wsl wslpath -a "$repo").Trim()
wsl -u root -- bash -c "LAN_IP=$ip bash '$wslRepo/deploy/standalone/install.sh' $flag"
New-NetFirewallRule -DisplayName "School System" -Direction Inbound -Protocol TCP -LocalPort 80,8000,8899 -Action Allow -ErrorAction SilentlyContinue | Out-Null
Write-Host "เสร็จแล้ว เปิด http://$ip จากเครื่องใดก็ได้ในโรงเรียน"
