@echo off
chcp 65001 >nul
title FaceGate Setup (Windows x64)
echo ==============================================
echo    FaceGate Setup (Windows x64)
echo ==============================================
echo.
set "CLOUD_URL=__CLOUD_URL__"
set "DEVICE_KEY=__DEVICE_KEY__"
if "%DEVICE_KEY%"=="__DEVICE_KEY__" set "DEVICE_KEY="
if "%DEVICE_KEY%"=="" set /p DEVICE_KEY=ใสร่ หัสเครื่ อง (Device Key) จากหน ้าหล ังบ ้าน:
set "FACEGATE_CLOUD_URL=%CLOUD_URL%"
set "FACEGATE_DEVICE_KEY=%DEVICE_KEY%"
echo.
echo กำล ังต ิดต ั ้ ง กรุณาอย่ าป ิ ดหน ้ าท ่ างน ้ี...
rem ไฟลต์ วโปรแกรมต ้ องมาก ั บ zip ท ี่ดาวน ์ โหลดจากหน ้ าเว็บบ ้ าน
rem ถ ้ าร ั นจากโฟลเดอร ์ ท ี่แตก zip แล ้ว (ม ี install.ps1 ข ้ างก ั น) → ร ั นท ั นท ี
rem ถ ้  าร ั นจากท ี่อ ื่ น → ดาวน ์ โหลด zip ท ั้ งหมดก่ อน แล ้วจ ึ งร ั นต ั วต ิ ดต ั ้ ง
set "SCRIPT_DIR=%~dp0"
if exist "%SCRIPT_DIR%install.ps1" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%install.ps1"
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$u='%CLOUD_URL%'; $z=Join-Path $env:TEMP 'facegate-agent.zip'; Invoke-WebRequest \"$u/downloads/facegate-agent-installer.zip\" -OutFile $z; $x=Join-Path $env:TEMP ('facegate-agent-' + [Guid]::NewGuid().ToString('N')); Expand-Archive $z $x -Force; & (Join-Path $x 'facegate-agent\install.ps1')"
)
echo.
pause
