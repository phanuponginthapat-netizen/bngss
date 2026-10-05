# เครื่องมือใน Start Menu: open | backup | restore | update | make-admin | keys
param([Parameter(Mandatory=$true)][string]$Action)
Add-Type -AssemblyName System.Windows.Forms
function Msg($t) { [System.Windows.Forms.MessageBox]::Show($t, "ระบบโรงเรียน") | Out-Null }
$repo = (Resolve-Path "$PSScriptRoot\..\..\..").Path
function WslRepo { (wsl -d SchoolSystem wslpath -a ($repo -replace '\\','/')).Trim() }

function Open-School {
  $ip = Get-Content "$env:ProgramData\SchoolSystem\server-ip.txt" -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $ip) {
    $log = "$env:ProgramData\SchoolSystem\install.log"
    Msg "ยังติดตั้งไม่เสร็จ (ไม่พบที่อยู่เครื่องแม่ข่าย)`n`nถ้าเพิ่งรีสตาร์ท ให้ล็อกอินแล้วรอหน้าต่างติดตั้งทำงานต่อจนเสร็จ`nดูบันทึกได้ที่: $log"
    if (Test-Path $log) { Start-Process notepad.exe $log }
    return
  }
  $url = "http://$($ip.Trim())"
  $ok = $false
  try { Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 3 | Out-Null; $ok = $true } catch {}
  if (-not $ok) {
    Start-ScheduledTask -TaskName 'SchoolSystem Start' -ErrorAction SilentlyContinue
    for ($i=0; $i -lt 36 -and -not $ok; $i++) {
      Start-Sleep 5
      try { Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 3 | Out-Null; $ok = $true } catch {}
    }
  }
  if ($ok) { Start-Process $url }
  else { Msg "ระบบยังไม่พร้อมที่ $url`n`nลองรีสตาร์ทเครื่อง หรือลองใหม่อีกครั้งใน 1-2 นาที" }
}

switch ($Action) {
  "open"    { Open-School }
  "backup"  { wsl -d SchoolSystem -u root -- /usr/local/bin/school-backup; Read-Host "สำรองข้อมูลเสร็จ กด Enter" }
  "restore" { wsl -d SchoolSystem -u root -- /usr/local/bin/school-restore; Read-Host "กด Enter" }
  "update"  { wsl -d SchoolSystem -u root -- /usr/local/bin/school-update; Read-Host "กด Enter" }
  "keys"    { Write-Host "ใส่กุญแจบริการ (LINE / AI / Google) - กด Enter เพื่อข้าม"; wsl -d SchoolSystem -u root -- /usr/local/bin/school-set-keys; Read-Host "กด Enter" }
  "make-admin" { $e = Read-Host "อีเมลผู้ดูแลระบบ"; $r = WslRepo; wsl -d SchoolSystem -u root -- bash "$r/deploy/standalone/make-admin.sh" $e; Read-Host "กด Enter" }
}
