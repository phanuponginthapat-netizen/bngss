# Runs elevated in the logged-in kiosk user's session, never as SYSTEM.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSCommandPath
$mutex = New-Object Threading.Mutex($false, 'Global\BNGFaceGateUpdate')
if (-not $mutex.WaitOne(0)) { exit }
try {
  $now = [TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow, 'SE Asia Standard Time')
  if ($now.Hour -ne 3) { exit }
  $config = @{}
  Get-Content (Join-Path $root 'facegate.env') | ForEach-Object {
    if ($_ -match '^([^#=]+)=(.*)$') { $config[$Matches[1]] = $Matches[2] }
  }
  if ($config['FACEGATE_AUTO_UPDATE'] -eq '0' -or -not $config['FACEGATE_DEVICE_KEY']) { exit }
  if (-not $config['FACEGATE_CLOUD_URL']) { $config['FACEGATE_CLOUD_URL']='https://dlkyxvhnnffblerwedjz.supabase.co/functions/v1' }
  $port = if ($config['FACEGATE_PORT']) { $config['FACEGATE_PORT'] } else { '8899' }
  $healthUrl = "http://127.0.0.1:$port/health"
  $health = Invoke-RestMethod $healthUrl -TimeoutSec 5
  if ($health.presence_active -or $health.pending_uploads -gt 0) { exit }
  $release = Invoke-RestMethod -Method Post -Uri ($config['FACEGATE_CLOUD_URL'].TrimEnd('/') + '/kiosk-api/update-release') -Headers @{'x-device-key'=$config['FACEGATE_DEVICE_KEY']} -ContentType 'application/json' -Body '{"platform":"windows"}' -TimeoutSec 30
  if (-not $release.enabled) { exit }
  if ($release.version -eq $health.version) { exit }
  if ($release.sha256 -notmatch '^[a-f0-9]{64}$' -or $release.url -notmatch '^https://') { throw 'Invalid release' }
  foreach ($name in @('installed-release.sha256','failed-release.sha256')) {
    if ((Test-Path (Join-Path $root $name)) -and (Get-Content (Join-Path $root $name) -Raw).Trim() -eq $release.sha256) { exit }
  }
  $installer = Join-Path $root 'FaceGateUpdate.exe'
  Invoke-WebRequest $release.url -OutFile $installer -UseBasicParsing -TimeoutSec 300
  if ((Get-FileHash $installer -Algorithm SHA256).Hash.ToLowerInvariant() -ne $release.sha256) { throw 'Checksum mismatch' }
  $health = Invoke-RestMethod $healthUrl -TimeoutSec 5
  $now = [TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow, 'SE Asia Standard Time')
  if ($now.Hour -ne 3 -or $health.presence_active -or $health.pending_uploads -gt 0) { exit }
  $backup = Join-Path (Split-Path $root -Parent) 'BNG FaceGate rollback'
  if (Test-Path $backup) { Remove-Item $backup -Recurse -Force }
  New-Item $backup -ItemType Directory | Out-Null
  Get-ChildItem $root | Where-Object { $_.Name -ne 'FaceGateUpdate.exe' } | Copy-Item -Destination $backup -Recurse -Force
  $ok = $false
  try {
  $process = Start-Process $installer -ArgumentList @('/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART',"/DIR=`"$root`"") -Wait -PassThru
  if ($process.ExitCode -eq 0) {
    Start-Process (Join-Path $root 'FaceGate.exe') -WorkingDirectory $root
    for ($i=0; $i -lt 180; $i++) {
      Start-Sleep 1
      try { $h=Invoke-RestMethod $healthUrl -TimeoutSec 3; if ($h.version -eq $release.version -and $h.engine_ready) { $ok=$true; break } } catch {}
    }
  }
  } catch { $ok=$false }
  if ($ok) { Set-Content (Join-Path $root 'installed-release.sha256') $release.sha256 } else {
    Get-Process FaceGate -ErrorAction SilentlyContinue | Stop-Process -Force
    Get-ChildItem $root | Where-Object { $_.Name -ne 'update.log' } | Remove-Item -Recurse -Force
    Get-ChildItem $backup | Copy-Item -Destination $root -Recurse -Force
    Set-Content (Join-Path $root 'failed-release.sha256') $release.sha256
    Start-Process (Join-Path $root 'FaceGate.exe') -WorkingDirectory $root
    throw 'Update failed; previous release restored'
  }
  Remove-Item $installer -Force -ErrorAction SilentlyContinue
} catch {
  Add-Content (Join-Path $root 'update.log') ("$(Get-Date -Format o) Update failed: " + $_.Exception.GetType().Name)
} finally {
  $mutex.ReleaseMutex()
  $mutex.Dispose()
}