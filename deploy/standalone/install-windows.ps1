# ติดตั้งแบบ Standalone บน Windows 10 (2004+) / 11 — ทำงานอัตโนมัติทั้งหมด ไม่ต้องกดอะไรระหว่างทาง
# สร้างเครื่อง Linux ส่วนตัวของระบบ (WSL2 ชื่อ SchoolSystem) ไว้ในโฟลเดอร์ DataDir บน HDD
# ติดตั้ง Docker ข้างในเอง (ไม่ใช้ Docker Desktop จึงไม่มีหน้าจอยอมรับเงื่อนไข) แล้วเรียก install.sh ตัวเดียวกับ Linux
# ถ้าต้องรีสตาร์ทครั้งแรก (เปิดฟีเจอร์ WSL) จะทำต่อเองหลังล็อกอิน
param(
  [string]$Mode = "", [string]$DataDir = "", [string]$AdminEmail = "", [string]$AdminPassword = "",
  [string]$KeysFile = "",
  [string]$SchoolName = "", [string]$SchoolNameEn = "", [string]$SchoolAddress = "", [string]$SchoolPhone = "",
  [string]$LogoFile = "",
  [string]$Domain = "", [string]$TunnelToken = "", [string]$StaticIp = "", [string]$Prefix = "24", [string]$Gateway = "", [string]$Dns = "8.8.8.8"
)
$ErrorActionPreference = "Continue"
$Distro = "SchoolSystem"
$PD = "$env:ProgramData\SchoolSystem"
$log = "$PD\install.log"
New-Item -ItemType Directory -Force -Path $PD | Out-Null
Start-Transcript -Path $log -Append | Out-Null
function Step($t) { Write-Host ""; Write-Host "==== $t ====" -ForegroundColor Cyan }
function Fail($t) { Write-Host "!! $t" -ForegroundColor Red; Write-Host "บันทึก: $log"; Stop-Transcript | Out-Null; Read-Host "กด Enter เพื่อปิด"; exit 1 }

function Resume-AfterReboot([string]$why) {
  $a = "-ExecutionPolicy Bypass -File `"$PSCommandPath`" -Mode $Mode -DataDir `"$DataDir`" -AdminEmail `"$AdminEmail`" -AdminPassword `"$AdminPassword`" -KeysFile `"$KeysFile`" -SchoolName `"$SchoolName`" -SchoolNameEn `"$SchoolNameEn`" -SchoolAddress `"$SchoolAddress`" -SchoolPhone `"$SchoolPhone`" -LogoFile `"$LogoFile`" -Domain `"$Domain`" -TunnelToken `"$TunnelToken`" -StaticIp `"$StaticIp`" -Prefix `"$Prefix`" -Gateway `"$Gateway`" -Dns `"$Dns`""
  New-ItemProperty -Path "HKLM:\Software\Microsoft\Windows\CurrentVersion\RunOnce" -Name "SchoolSystemSetup" -Value "powershell.exe $a" -Force | Out-Null
  Write-Host "$why`nต้องรีสตาร์ทเครื่อง 1 ครั้ง — หลังล็อกอิน การติดตั้งจะทำต่อเองอัตโนมัติ" -ForegroundColor Yellow
  Stop-Transcript | Out-Null
  Add-Type -AssemblyName System.Windows.Forms
  if ([System.Windows.Forms.MessageBox]::Show("$why`n`nรีสตาร์ทเครื่องตอนนี้เลยไหม? (การติดตั้งจะทำต่อเองหลังล็อกอิน)", "ระบบโรงเรียน", "YesNo") -eq "Yes") { Restart-Computer -Force }
  exit 3010
}
function W { param([Parameter(ValueFromRemainingArguments=$true)]$rest) & wsl.exe -d $Distro -u root -- @rest }

if (-not $Mode) { $Mode = "standalone" }
if (-not $DataDir) { $DataDir = "C:\SchoolData" }
New-Item -ItemType Directory -Force -Path $DataDir | Out-Null
# เก็บไฟล์จากหน้าติดตั้งไว้ใน DataDir (โฟลเดอร์ชั่วคราวของ setup.exe หายหลังรีสตาร์ท)
if ($KeysFile -and (Test-Path $KeysFile) -and ($KeysFile -notlike "$DataDir*")) { Copy-Item $KeysFile "$DataDir\keys.env" -Force; $KeysFile = "$DataDir\keys.env" }
if ($LogoFile -and (Test-Path $LogoFile)) { $ext = [IO.Path]::GetExtension($LogoFile).ToLower(); if ($LogoFile -ne "$DataDir\logo$ext") { Copy-Item $LogoFile "$DataDir\logo$ext" -Force }; $LogoFile = "$DataDir\logo$ext" }

# 0) IP คงที่
if ($StaticIp) {
  Step "ตั้ง IP คงที่ $StaticIp"
  $nic = Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq "Up" -and $_.InterfaceAlias -notmatch "vEthernet|WSL" } | Select-Object -First 1
  if ($nic) {
    $idx = $nic.InterfaceIndex
    $cur = (Get-NetIPAddress -InterfaceIndex $idx -AddressFamily IPv4 -ErrorAction SilentlyContinue).IPAddress
    if ($cur -notcontains $StaticIp) {
      Set-NetIPInterface -InterfaceIndex $idx -Dhcp Disabled
      Get-NetIPAddress -InterfaceIndex $idx -AddressFamily IPv4 -ErrorAction SilentlyContinue | Remove-NetIPAddress -Confirm:$false -ErrorAction SilentlyContinue
      Remove-NetRoute -InterfaceIndex $idx -DestinationPrefix "0.0.0.0/0" -Confirm:$false -ErrorAction SilentlyContinue
      New-NetIPAddress -InterfaceIndex $idx -IPAddress $StaticIp -PrefixLength ([int]$Prefix) -DefaultGateway $Gateway | Out-Null
      Set-DnsClientServerAddress -InterfaceIndex $idx -ServerAddresses @($Dns, $Gateway)
      Start-Sleep 8
    }
  } else { Write-Host "ไม่พบการ์ดเครือข่าย — ข้าม" }
}

# 1) เปิดฟีเจอร์ WSL2 (ครั้งแรกต้องรีสตาร์ท)
Step "ตรวจ WSL2"
$feat = Get-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform
$feat2 = Get-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux
if ($feat.State -ne "Enabled" -or $feat2.State -ne "Enabled") {
  Enable-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform -NoRestart -All | Out-Null
  Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux -NoRestart -All | Out-Null
  wsl.exe --install --no-distribution 2>$null | Out-Null
  Resume-AfterReboot "เปิดใช้ WSL2 แล้ว"
}
wsl.exe --update 2>$null | Out-Null
wsl.exe --set-default-version 2 2>$null | Out-Null

# 2) สร้างเครื่อง Linux ของระบบไว้บน HDD (ไม่ต้องตั้งชื่อผู้ใช้/รหัสผ่าน)
$have = ((wsl.exe -l -q 2>$null) -replace "`0","") -contains $Distro
if (-not $have) {
  Step "ดาวน์โหลดและสร้างระบบ Linux (ประมาณ 350 MB)"
  $tar = "$DataDir\ubuntu-rootfs.tar.gz"
  if (-not (Test-Path $tar)) {
    $ProgressPreference = "SilentlyContinue"
    Invoke-WebRequest "https://cloud-images.ubuntu.com/wsl/releases/24.04/current/ubuntu-noble-wsl-amd64-24.04lts.rootfs.tar.gz" -OutFile $tar -UseBasicParsing
  }
  New-Item -ItemType Directory -Force "$DataDir\wsl" | Out-Null
  wsl.exe --import $Distro "$DataDir\wsl" $tar --version 2
  if ($LASTEXITCODE -ne 0) { Fail "สร้างระบบ Linux ไม่สำเร็จ (ตรวจว่าเปิด Virtualization ใน BIOS แล้ว)" }
  Remove-Item $tar -Force -ErrorAction SilentlyContinue
}
W bash -c "printf '[boot]\nsystemd=true\n[user]\ndefault=root\n[interop]\nappendWindowsPath=false\n' > /etc/wsl.conf"
wsl.exe --terminate $Distro | Out-Null
Start-Sleep 3

# 3) Docker ภายในเครื่อง Linux
Step "ติดตั้ง Docker (ภายในระบบ ไม่ต้องใช้ Docker Desktop)"
W bash -c "command -v docker >/dev/null || (apt-get update -y && apt-get install -y curl ca-certificates && curl -fsSL https://get.docker.com | sh)"
W bash -c "systemctl enable --now docker >/dev/null 2>&1 || service docker start"
$ok = $false; for ($i=0; $i -lt 30; $i++) { W docker info *> $null; if ($LASTEXITCODE -eq 0) { $ok = $true; break }; Start-Sleep 3 }
if (-not $ok) { Fail "Docker เริ่มทำงานไม่ได้" }

# 4) ตัวช่วยเปิดระบบอัตโนมัติทุกครั้งที่เปิดเครื่อง + ส่งต่อพอร์ตให้เครื่องอื่นใน LAN เข้าได้
Step "ตั้งค่าให้ระบบเปิดเองทุกครั้งที่เปิดเครื่อง"
$start = @"
`$ErrorActionPreference = 'SilentlyContinue'
Start-Process wsl.exe -ArgumentList '-d','$Distro','-u','root','--','bash','-c','service docker start >/dev/null 2>&1; exec sleep infinity' -WindowStyle Hidden
for (`$i=0; `$i -lt 30; `$i++) { `$w = ((wsl.exe -d $Distro -u root -- hostname -I) -split ' ')[0].Trim(); if (`$w) { break }; Start-Sleep 2 }
foreach (`$p in 80,443,8000) {
  netsh interface portproxy delete v4tov4 listenport=`$p listenaddress=0.0.0.0 | Out-Null
  netsh interface portproxy add v4tov4 listenport=`$p listenaddress=0.0.0.0 connectport=`$p connectaddress=`$w | Out-Null
}
"@
[IO.File]::WriteAllText("$PD\start.ps1", $start, (New-Object System.Text.UTF8Encoding $true))
$act = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$PD\start.ps1`""
$trg = @((New-ScheduledTaskTrigger -AtStartup), (New-ScheduledTaskTrigger -AtLogOn))
$pri = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType S4U -RunLevel Highest
$set = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName "SchoolSystem Start" -Action $act -Trigger $trg -Principal $pri -Settings $set -Force | Out-Null
Start-ScheduledTask -TaskName "SchoolSystem Start"
Start-Sleep 5

# 5) ติดตั้งระบบโรงเรียน (ฐานข้อมูล + เว็บ) — ข้อมูลอยู่ในดิสก์ของระบบใน $DataDir\wsl บน HDD
Step "ติดตั้งฐานข้อมูลและหน้าเว็บ (10-30 นาที ห้ามปิดหน้าต่างนี้)"
$ip = if ($StaticIp) { $StaticIp } else { (Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq "Up" -and $_.InterfaceAlias -notmatch "vEthernet|WSL" } | Select-Object -First 1).IPv4Address.IPAddress }
if (-not $ip) { $ip = "localhost" }
$toWsl = { param($p) (wsl.exe -d $Distro -u root -- wslpath -a ($p -replace '\\','/')).Trim() }
$repo = (Resolve-Path "$PSScriptRoot\..\..").Path
$wslRepo = & $toWsl $repo
$wslKeys = if ($KeysFile -and (Test-Path $KeysFile)) { & $toWsl $KeysFile } else { "" }
$wslLogo = if ($LogoFile -and (Test-Path $LogoFile)) { & $toWsl $LogoFile } else { "" }
$wslBackup = & $toWsl "$DataDir\backups"
New-Item -ItemType Directory -Force "$DataDir\backups" | Out-Null
$env:SCHOOL_ADMIN_PASSWORD = $AdminPassword; $env:SCHOOL_NAME = $SchoolName; $env:SCHOOL_NAME_EN = $SchoolNameEn; $env:SCHOOL_ADDRESS = $SchoolAddress; $env:SCHOOL_PHONE = $SchoolPhone
$env:WSLENV = "SCHOOL_ADMIN_PASSWORD/u:SCHOOL_NAME/u:SCHOOL_NAME_EN/u:SCHOOL_ADDRESS/u:SCHOOL_PHONE/u"
$flag = if ($Mode -eq "hybrid") { "--hybrid" } else { "" }
W bash -c "ADMIN_PASSWORD=`"`$SCHOOL_ADMIN_PASSWORD`" ADMIN_EMAIL='$AdminEmail' DOMAIN='$Domain' TUNNEL_TOKEN='$($TunnelToken -replace "'",'')' KEYS_FILE='$wslKeys' LOGO_FILE='$wslLogo' LAN_IP=$ip BACKUP_DIR='$wslBackup' DATA_DIR='/opt/school/stack' bash '$wslRepo/deploy/standalone/install.sh' $flag"
$rc = $LASTEXITCODE
Remove-Item Env:SCHOOL_ADMIN_PASSWORD -ErrorAction SilentlyContinue
if ($KeysFile -and (Test-Path $KeysFile)) { Remove-Item $KeysFile -Force }
if ($rc -ne 0) { Fail "ติดตั้งระบบไม่สำเร็จ (รหัส $rc)" }

New-NetFirewallRule -DisplayName "School System" -Direction Inbound -Protocol TCP -LocalPort 80,443,8000 -Action Allow -ErrorAction SilentlyContinue | Out-Null
Start-ScheduledTask -TaskName "SchoolSystem Start"
Set-Content -Path "$PD\server-ip.txt" -Value $ip
Set-Content -Path "$DataDir\server-ip.txt" -Value $ip

Step "รอหน้าเว็บพร้อม"
$up = $false; for ($i=0; $i -lt 60; $i++) { try { Invoke-WebRequest "http://localhost" -UseBasicParsing -TimeoutSec 3 | Out-Null; $up = $true; break } catch { Start-Sleep 5 } }
if (-not $up) { Fail "ติดตั้งครบแล้วแต่หน้าเว็บยังไม่ตอบ ลองรีสตาร์ทเครื่องแล้วเปิดไอคอน 'ระบบโรงเรียน'" }
Write-Host "`nเสร็จแล้ว! เปิด http://$ip จากเครื่องใดก็ได้ในโรงเรียน" -ForegroundColor Green
Stop-Transcript | Out-Null
Start-Process "http://$ip"
