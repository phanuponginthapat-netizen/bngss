# ติดตั้งแบบ Standalone บน Windows 10/11 (เรียกจาก setup.exe หรือคลิกขวา > Run with PowerShell ในฐานะ Administrator)
# ใช้ WSL2 + Docker Desktop แล้วเรียก install.sh ตัวเดียวกับ Linux
param(
  [string]$Mode = "",          # standalone | hybrid
  [string]$DataDir = "",       # โฟลเดอร์บน HDD เช่น D:\SchoolData
  [string]$AdminEmail = ""
)
$ErrorActionPreference = "Stop"
if (-not (wsl -l -q 2>$null)) { wsl --install -d Ubuntu; Write-Host "รีสตาร์ทเครื่องแล้วรันตัวติดตั้งอีกครั้ง"; exit 3010 }
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  winget install -e --id Docker.DockerDesktop --accept-source-agreements --accept-package-agreements
  Write-Host "เปิด Docker Desktop (เปิด WSL integration) แล้วรันตัวติดตั้งอีกครั้ง"; exit 3010
}
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.PrefixOrigin -eq "Dhcp" -or $_.PrefixOrigin -eq "Manual" } | Where-Object { $_.IPAddress -notlike "169.*" -and $_.IPAddress -ne "127.0.0.1" } | Select-Object -First 1).IPAddress
if (-not $Mode) { $m = Read-Host "เลือกแบบ: 1 = ใช้ในโรงเรียนอย่างเดียว, 2 = แบบผสม (สำรองขึ้น Cloud)"; $Mode = if ($m -eq "2") { "hybrid" } else { "standalone" } }
$flag = if ($Mode -eq "hybrid") { "--hybrid" } else { "" }
if (-not $DataDir) { $DataDir = "C:\SchoolData" }
New-Item -ItemType Directory -Force -Path $DataDir | Out-Null
$wslData = (wsl wslpath -a ($DataDir -replace '\\','/')).Trim()
$repo = (Resolve-Path "$PSScriptRoot\..\..").Path
$wslRepo = (wsl wslpath -a ($repo -replace '\\','/')).Trim()
wsl -u root -- bash -c "LAN_IP=$ip DATA_DIR='$wslData/stack' bash '$wslRepo/deploy/standalone/install.sh' $flag"
New-NetFirewallRule -DisplayName "School System" -Direction Inbound -Protocol TCP -LocalPort 80,8000,8899 -Action Allow -ErrorAction SilentlyContinue | Out-Null
# เปิดเครื่องแล้วให้ Docker Desktop เริ่มเอง (ระบบตั้ง restart=unless-stopped ไว้แล้ว)
$dd = "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe"
if (Test-Path $dd) { New-ItemProperty -Path "HKLM:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "DockerDesktop" -Value "`"$dd`"" -Force | Out-Null }
Set-Content -Path "$DataDir\server-ip.txt" -Value $ip
if ($AdminEmail) { Write-Host "สมัครผู้ใช้ $AdminEmail ที่ http://$ip แล้วกดไอคอน 'ตั้งผู้ดูแลระบบ' ใน Start Menu" }
Write-Host "เสร็จแล้ว เปิด http://$ip จากเครื่องใดก็ได้ในโรงเรียน"
