# ติดตั้ง FaceGate Agent (สแกนใบหน้าแบบเนทีฟ) บนเครื่องคีออส Windows
#   คลิกขวา → Run with PowerShell   (หรือ  powershell -ExecutionPolicy Bypass -File install.ps1)
$ErrorActionPreference = "Stop"

$src   = Split-Path -Parent $MyInvocation.MyCommand.Path
$root  = Join-Path $env:LOCALAPPDATA "FaceGateAgent"
$models = Join-Path $root "models"
$hf = "https://huggingface.co/deepghs/insightface/resolve/main/buffalo_s"

New-Item -ItemType Directory -Force -Path $models | Out-Null
Copy-Item (Join-Path $src "agent.py")        $root -Force
Copy-Item (Join-Path $src "face_engine.py")  $root -Force
Copy-Item (Join-Path $src "requirements.txt") $root -Force

Write-Host "==> สร้าง Python environment"
python -m venv (Join-Path $root ".venv")
$py = Join-Path $root ".venv\Scripts\python.exe"
& $py -m pip install --upgrade pip
& $py -m pip install -r (Join-Path $root "requirements.txt")

Write-Host "==> ดาวน์โหลดโมเดล (ครั้งเดียว ~17 MB)"
foreach ($m in @("det_500m.onnx", "w600k_mbf.onnx")) {
  $dest = Join-Path $models $m
  if (-not (Test-Path $dest)) { Invoke-WebRequest "$hf/$m" -OutFile $dest }
}

# สคริปต์เริ่มทำงาน + ให้รันอัตโนมัติตอนเปิดเครื่อง
$bat = Join-Path $root "start-facegate.bat"
@"
@echo off
set FACEGATE_MODEL_DIR=$models
set FACEGATE_PORT=8899
cd /d "$root"
"$py" agent.py
"@ | Set-Content -Encoding ASCII $bat

$startup = [Environment]::GetFolderPath("Startup")
$ws = New-Object -ComObject WScript.Shell
$lnk = $ws.CreateShortcut((Join-Path $startup "FaceGate Agent.lnk"))
$lnk.TargetPath = $bat
$lnk.WindowStyle = 7
$lnk.Save()

Start-Process -WindowStyle Minimized $bat
Start-Sleep -Seconds 5
try { (Invoke-WebRequest "http://127.0.0.1:8899/health" -UseBasicParsing).Content }
catch { Write-Warning "agent ยังไม่ตอบ — ลองเปิด $bat เพื่อดูข้อความผิดพลาด" }

Write-Host "เสร็จแล้ว ✅ เปิดหน้า /face-kiosk บนเครื่องนี้ ระบบจะใช้ตัวประมวลผลเนทีฟอัตโนมัติ"
