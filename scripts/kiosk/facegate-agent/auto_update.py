"""Linux supervisor: verified releases, isolated dependencies and health rollback."""
import hashlib
import io
import json
import os
import fcntl
from pathlib import Path
import shutil
import subprocess
import sys
import time
from datetime import datetime, timezone, timedelta
import zipfile
import requests

PROGRAM_FILES = ('.py', '.txt', '.md')

def update_window(now=None):
    now = now or datetime.now(timezone(timedelta(hours=7)))
    return now.hour == 3  # 03:00–03:59 Bangkok, never during the school queue

def unpack_verified(body, sha, target):
    if len(sha) != 64 or hashlib.sha256(body).hexdigest() != sha:
        raise ValueError('update checksum mismatch')
    with zipfile.ZipFile(io.BytesIO(body)) as archive:
        if sum(i.file_size for i in archive.infolist()) > 20_000_000:
            raise ValueError('update archive too large')
        for item in archive.infolist():
            parts = item.filename.split('/')
            if len(parts) != 2 or parts[0] != 'facegate-agent' or not parts[1]:
                continue
            name = parts[1]
            if name.startswith('.') or '\\' in name or not name.endswith(PROGRAM_FILES):
                continue
            (target / name).write_bytes(archive.read(item))
    for required in ('agent.py', 'auto_update.py', 'requirements.txt'):
        if not (target / required).is_file():
            raise ValueError('incomplete release')

def ready(port, version):
    try:
        health = requests.get(f'http://127.0.0.1:{port}/health', timeout=3).json()
        return health.get('version') == version and health.get('engine_ready') is True
    except Exception:
        return False

def start(root):
    return subprocess.Popen([str(root / '.venv/bin/python'), str(root / 'agent.py')], cwd=root)

def stop(child):
    child.terminate()
    try:
        child.wait(timeout=20)
    except subprocess.TimeoutExpired:
        child.kill()
        child.wait()

def install(root, stage, child, version):
    """Only program files and the isolated venv change; config/cache/outbox never do."""
    backup = root / '.update-backup'
    if backup.exists():
        shutil.rmtree(backup)
    backup.mkdir()
    old = [p for p in root.iterdir() if p.is_file() and p.name.endswith(PROGRAM_FILES)]
    for file in old:
        shutil.copy2(file, backup / file.name)
    stop(child)
    shutil.move(str(root / '.venv'), str(backup / '.venv'))
    try:
        shutil.move(str(stage / '.venv'), str(root / '.venv'))
        for file in stage.iterdir():
            if file.is_file() and file.name.endswith(PROGRAM_FILES):
                shutil.copy2(file, root / file.name)
        child = start(root)
        for _ in range(180):
            if child.poll() is not None:
                break
            if ready(os.environ.get('FACEGATE_PORT', '8899'), version):
                return child
            time.sleep(1)
        stop(child)
        raise RuntimeError('new release did not become ready')
    except Exception:
        for file in root.iterdir():
            if file.is_file() and file.name.endswith(PROGRAM_FILES):
                file.unlink()
        shutil.rmtree(root / '.venv', ignore_errors=True)
        shutil.move(str(backup / '.venv'), str(root / '.venv'))
        for file in backup.iterdir():
            if file.is_file():
                shutil.copy2(file, root / file.name)
        print('[update] rolled back to previous release', flush=True)
        return start(root)

def main():
    from cloud_config import cloud_api_url
    root = Path(__file__).resolve().parent
    child = start(root)
    checked = 0
    cache = Path(os.environ.get('FACEGATE_CACHE_DIR', str(Path.home() / '.local/share/FaceGate/cache')))
    marker = cache / 'installed-release.sha256'
    blocked = cache / 'failed-release.sha256'
    try:
        while True:
            if child.poll() is not None:
                time.sleep(5)
                child = start(root)
            if update_window() and time.time() - checked >= 3600 and os.environ.get('FACEGATE_AUTO_UPDATE', '1') != '0':
                checked = time.time()
                try:
                    endpoint = cloud_api_url(os.environ.get('FACEGATE_CLOUD_URL'))
                    response = requests.post(endpoint + '/kiosk-api/update-release', headers={'x-device-key': os.environ.get('FACEGATE_DEVICE_KEY', '')}, json={'platform': 'linux'}, timeout=30)
                    response.raise_for_status()
                    release = response.json()
                    sha = release['sha256']
                    if any(p.exists() and p.read_text().strip() == sha for p in (marker, blocked)):
                        continue
                    health = requests.get('http://127.0.0.1:' + os.environ.get('FACEGATE_PORT', '8899') + '/health', timeout=5).json()
                    if health.get('version') == release['version']:
                        continue
                    if health.get('presence_active') or health.get('pending_uploads') or not release.get('enabled'):
                        continue
                    download = requests.get(release['url'], timeout=180)
                    download.raise_for_status()
                    stage = root / '.update-stage'
                    shutil.rmtree(stage, ignore_errors=True)
                    stage.mkdir()
                    unpack_verified(download.content, sha, stage)
                    subprocess.run([sys.executable, '-m', 'venv', '--system-site-packages', str(stage / '.venv')], check=True, timeout=120)
                    subprocess.run([str(stage / '.venv/bin/python'), '-m', 'pip', 'install', '-r', str(stage / 'requirements.txt'), 'pywebview>=5,<6'], check=True, timeout=600)
                    # Recheck the queue after preparation, before stopping scanning.
                    health = requests.get('http://127.0.0.1:' + os.environ.get('FACEGATE_PORT', '8899') + '/health', timeout=5).json()
                    if not update_window() or health.get('presence_active') or health.get('pending_uploads'):
                        continue
                    child = install(root, stage, child, release['version'])
                    cache.mkdir(parents=True, exist_ok=True)
                    (marker if ready(os.environ.get('FACEGATE_PORT', '8899'), release['version']) else blocked).write_text(sha)
                except Exception as exc:
                    print('[update] failed:', type(exc).__name__, flush=True)
            time.sleep(10)
    finally:
        stop(child)

if __name__ == '__main__':
    with open(Path(__file__).resolve().parent / '.update.lock', 'w') as guard:
        try:
            fcntl.flock(guard, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            sys.exit(0)
        main()