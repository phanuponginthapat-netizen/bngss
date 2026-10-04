# ติดตั้งแบบ Standalone บน Windows 10/11 (เรียกจาก setup.exe หรือคลิกขวา > Run with PowerShell ในฐานะ Administrator)
# ใช้ WSL2 + Docker Desktop แล้วเรียก install.sh ตัวเดียวกับ Linux — ข้อมูลทั้งหมดอยู่ใน DataDir บน HDD
# ถ้าต้องรีสตาร์ทเครื่องระหว่างติดตั้ง จะทำต่อเองอัตโนมัติหลังล็อกอินครั้งถัดไป
param(
  [string]$Mode = "",          # standalone | hybrid
  [string]$DataDir = "",       # โฟลเดอร์บน HDD เช่น D:\SchoolData
  [string]$AdminEmail = "",
  [string]$AdminPassword = "",
  [string]$KeysFile = "",      # ไฟล์ KEY=VALUE จากหน้า setup.exe (ลบทิ้งหลังนำเข้า)
  [string]$SchoolName = "", [string]$SchoolNameEn = "", [string]$SchoolAddress = "", [string]$SchoolPhone = "",
  [string]$LogoFile = "",
  [string]$StaticIp = "", [string]$Prefix = "24", [string]$Gateway = "", [string]$Dns = "8.8.8.8"
)
$ErrorActionPreference = "Stop"
$log = "$env:ProgramData\SchoolSystem\install.log"
New-Item -ItemType Directory -Force -Path (Split-Path $log) | Out-Null
Start-Transcript -Path $log -Append | Out-Null

function Resume-AfterReboot([string]$why) {
  $args = "-ExecutionPolicy Bypass -File `"$PSCommandPath`" -Mode $Mode -DataDir `"$DataDir`" -AdminEmail `"$AdminEmail`" -AdminPassword `"$AdminPassword`" -KeysFile `"$KeysFile`" -SchoolName `"$SchoolName`" -SchoolNameEn `"$SchoolNameEn`" -SchoolAddress `"$SchoolAddress`" -SchoolPhone `"$SchoolPhone`" -LogoFile `"$LogoFile`" -StaticIp `"$StaticIp`" -Prefix `"$Prefix`" -Gateway `"$Gateway`" -Dns `"$Dns`""
  New-ItemProperty -Path "HKLM:\Software\Microsoft\Windows\CurrentVersion\RunOnce" -Name "SchoolSystemSetup" -Value "powershell.exe $args" -Force | Out-Null
  Write-Host "$why`nกรุณารีสตาร์ทเครื่อง — การติดตั้งจะทำต่อเองหลังล็อกอิน"
  Stop-Transcript | Out-Null; exit 3010
}

if (-not $Mode) { $m = Read-Host "เลือกแบบ: 1 = ใช้ในโรงเรียนอย่างเดียว, 2 = แบบผสม (สำรองขึ้น Cloud)"; $Mode = if ($m -eq "2") { "hybrid" } else { "standalone" } }
if (-not $DataDir) { $DataDir = "C:\SchoolData" }
New-Item -ItemType Directory -Force -Path $DataDir | Out-Null
# เก็บไฟล์จากหน้าติดตั้งไว้ใน DataDir (โฟลเดอร์ชั่วคราวของ setup.exe จะหายหลังรีสตาร์ท)
if ($KeysFile -and (Test-Path $KeysFile) -and ($KeysFile -notlike "$DataDir*")) { Copy-Item $KeysFile "$DataDir\keys.env" -Force; $KeysFile = "$DataDir\keys.env" }
if ($LogoFile -and (Test-Path $LogoFile)) { $ext = [IO.Path]::GetExtension($LogoFile).ToLower(); if ($LogoFile -ne "$DataDir\logo$ext") { Copy-Item $LogoFile "$DataDir\logo$ext" -Force }; $LogoFile = "$DataDir\logo$ext" }

# 0) IP คงที่ของเครื่องแม่ข่าย (ทุกเครื่องในโรงเรียนชี้มาที่ IP นี้)
if ($StaticIp) {
  $nic = Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq "Up" } | Select-Object -First 1
  if (-not $nic) { $nic = Get-NetIPConfiguration | Where-Object { $_.NetAdapter.Status -eq "Up" -and $_.InterfaceAlias -notmatch "vEthernet|WSL|Loopback" } | Select-Object -First 1 }
  if ($nic) {
    $idx = $nic.InterfaceIndex
    $cur = (Get-NetIPAddress -InterfaceIndex $idx -AddressFamily IPv4 -ErrorAction SilentlyContinue).IPAddress
    if ($cur -notcontains $StaticIp) {
      Write-Host "ตั้ง IP คงที่ $StaticIp/$Prefix gateway $Gateway ที่การ์ด $($nic.InterfaceAlias)"
      Set-NetIPInterface -InterfaceIndex $idx -Dhcp Disabled
      Get-NetIPAddress -InterfaceIndex $idx -AddressFamily IPv4 -ErrorAction SilentlyContinue | Remove-NetIPAddress -Confirm:$false -ErrorAction SilentlyContinue
      Remove-NetRoute -InterfaceIndex $idx -DestinationPrefix "0.0.0.0/0" -Confirm:$false -ErrorAction SilentlyContinue
      New-NetIPAddress -InterfaceIndex $idx -IPAddress $StaticIp -PrefixLength ([int]$Prefix) -DefaultGateway $Gateway | Out-Null
      Set-DnsClientServerAddress -InterfaceIndex $idx -ServerAddresses @($Dns, $Gateway)
      Start-Sleep 5
    }
  } else { Write-Host "!! ไม่พบการ์ดเครือข่าย — ข้ามการตั้ง IP คงที่" }
}

# 1) WSL2 + Ubuntu
$distros = (wsl -l -q 2>$null) -replace "`0","" | Where-Object { $_ -match "Ubuntu" }
if (-not $distros) {
  wsl --install -d Ubuntu --no-launch
  Resume-AfterReboot "ติดตั้ง WSL2 แล้ว"
}
# 2) Docker Desktop
$dd = "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe"
if (-not (Test-Path $dd)) {
  winget install -e --id Docker.DockerDesktop --accept-source-agreements --accept-package-agreements
  Resume-AfterReboot "ติดตั้ง Docker Desktop แล้ว"
}
New-ItemProperty -Path "HKLM:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "DockerDesktop" -Value "`"$dd`"" -Force | Out-Null
Start-Process $dd -ErrorAction SilentlyContinue
Write-Host "รอ Docker พร้อม..."
$ok = $false; for ($i=0; $i -lt 90; $i++) { wsl -d Ubuntu -u root -- docker info *> $null; if ($LASTEXITCODE -eq 0) { $ok = $true; break }; Start-Sleep 5 }
if (-not $ok) { Write-Host "Docker ยังไม่พร้อม: เปิด Docker Desktop > Settings > Resources > WSL integration > เปิด Ubuntu แล้วรันอีกครั้ง"; Stop-Transcript | Out-Null; exit 1 }

# 3) ติดตั้งระบบ
$ip = if ($StaticIp) { $StaticIp } else { (Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq "Up" } | Select-Object -First 1).IPv4Address.IPAddress }
if (-not $ip) { $ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.PrefixOrigin -in "Dhcp","Manual" -and $_.IPAddress -notlike "169.*" -and $_.IPAddress -ne "127.0.0.1" } | Select-Object -First 1).IPAddress }
$wslLogo = if ($LogoFile -and (Test-Path $LogoFile)) { (wsl -d Ubuntu wslpath -a ($LogoFile -replace '\\','/')).Trim() } else { "" }
$env:SCHOOL_NAME = $SchoolName; $env:SCHOOL_NAME_EN = $SchoolNameEn; $env:SCHOOL_ADDRESS = $SchoolAddress; $env:SCHOOL_PHONE = $SchoolPhone
$flag = if ($Mode -eq "hybrid") { "--hybrid" } else { "" }
$toWsl = { param($p) (wsl -d Ubuntu wslpath -a ($p -replace '\\','/')).Trim() }
$wslData = & $toWsl $DataDir
$repo = (Resolve-Path "$PSScriptRoot\..\..").Path
$wslRepo = & $toWsl $repo
$wslKeys = if ($KeysFile -and (Test-Path $KeysFile)) { & $toWsl $KeysFile } else { "" }
$env:SCHOOL_ADMIN_PASSWORD = $AdminPassword
$env:WSLENV = "SCHOOL_ADMIN_PASSWORD/u:SCHOOL_NAME/u:SCHOOL_NAME_EN/u:SCHOOL_ADDRESS/u:SCHOOL_PHONE/u"
wsl -d Ubuntu -u root -- bash -c "ADMIN_PASSWORD=`"`$SCHOOL_ADMIN_PASSWORD`" ADMIN_EMAIL='$AdminEmail' KEYS_FILE='$wslKeys' LOGO_FILE='$wslLogo' LAN_IP=$ip DATA_DIR='$wslData/stack' bash '$wslRepo/deploy/standalone/install.sh' $flag"
Remove-Item Env:SCHOOL_ADMIN_PASSWORD -ErrorAction SilentlyContinue
if ($KeysFile -and (Test-Path $KeysFile)) { Remove-Item $KeysFile -Force }

New-NetFirewallRule -DisplayName "School System" -Direction Inbound -Protocol TCP -LocalPort 80,8000,8899 -Action Allow -ErrorAction SilentlyContinue | Out-Null
Set-Content -Path "$DataDir\server-ip.txt" -Value $ip
Copy-Item "$DataDir\server-ip.txt" "$env:ProgramData\SchoolSystem\server-ip.txt" -Force
Write-Host "เสร็จแล้ว เปิด http://$ip จากเครื่องใดก็ได้ในโรงเรียน"
Stop-Transcript | Out-Null
Start-Process "http://$ip"
