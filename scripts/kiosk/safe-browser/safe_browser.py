"""BNG Safe Browser for Windows — kiosk launcher.

Runs a bundled Chromium (Chrome for Testing) full-screen with the school Safe Browser
extension, relaunches it if closed, blocks common escape keys, and only quits or powers
off after the school server confirms a staff/admin card QR. Remote shutdown arrives
through the shared FaceGate power-command queue using this machine's device key.
"""
from __future__ import annotations

import ctypes
import json
import os
import shutil
import subprocess
import sys
import threading
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

APP_VERSION = "1.0.0"
PORT = 47831
EXTENSION_ID = "pmkbhlpecjcgmcmbfiaggbockmmfpbig"
ALLOWED_ORIGIN = f"chrome-extension://{EXTENSION_ID}"
BASE = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent)) if getattr(sys, "frozen", False) else Path(__file__).resolve().parent
APP_DIR = Path(sys.executable).resolve().parent if getattr(sys, "frozen", False) else BASE
DATA_DIR = Path(os.environ.get("LOCALAPPDATA", str(APP_DIR))) / "BNG Safe Browser"


def load_env() -> dict[str, str]:
    env: dict[str, str] = {}
    f = APP_DIR / "safebrowser.env"
    if f.exists():
        for line in f.read_text(encoding="utf-8", errors="ignore").splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    return env


CFG = load_env()
HOME_URL = CFG.get("SAFEBROWSER_HOME_URL", "https://bngss.online")
CLOUD_URL = CFG.get("SAFEBROWSER_CLOUD_URL", "https://dlkyxvhnnffblerwedjz.supabase.co/functions/v1").rstrip("/")
DEVICE_KEY = CFG.get("SAFEBROWSER_DEVICE_KEY", "")
KIOSK = CFG.get("SAFEBROWSER_KIOSK", "1") != "0"

state = {"exiting": False, "proc": None, "last_error": ""}


def log(*a):
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        with open(DATA_DIR / "safe-browser.log", "a", encoding="utf-8") as f:
            f.write(time.strftime("%Y-%m-%d %H:%M:%S ") + " ".join(map(str, a)) + "\n")
    except OSError:
        pass


def cloud(route: str, body: dict, timeout: float = 15) -> tuple[int, dict]:
    if not DEVICE_KEY:
        return 0, {"error": "ยังไม่ได้ตั้งรหัสเครื่อง (Device Key)"}
    req = urllib.request.Request(f"{CLOUD_URL}/kiosk-api/{route}", data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json", "x-device-key": DEVICE_KEY}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or b"{}")
        except ValueError:
            return e.code, {}
    except Exception as e:  # network down
        return 0, {"error": f"เชื่อมต่อระบบโรงเรียนไม่ได้: {e.__class__.__name__}"}


# ── Browser ────────────────────────────────────────────────────────────────
def chrome_path() -> Path | None:
    for p in (APP_DIR / "chrome" / "chrome.exe", BASE / "chrome" / "chrome.exe"):
        if p.exists():
            return p
    return None


def browser_args(exe: Path) -> list[str]:
    ext = APP_DIR / "extension"
    args = [str(exe), f"--user-data-dir={DATA_DIR / 'profile'}", f"--load-extension={ext}",
            f"--disable-extensions-except={ext}", "--no-first-run", "--no-default-browser-check",
            "--disable-session-crashed-bubble", "--disable-infobars", "--noerrdialogs",
            "--disable-features=Translate,DownloadBubble", "--use-fake-ui-for-media-stream",
            "--autoplay-policy=no-user-gesture-required", "--disable-dev-tools", "--disable-print-preview"]
    if KIOSK:
        args += ["--kiosk", "--start-fullscreen"]
    return args + [HOME_URL]


def browser_loop():
    while not state["exiting"]:
        exe = chrome_path()
        if not exe:
            state["last_error"] = "ไม่พบเบราว์เซอร์ในโฟลเดอร์โปรแกรม"
            log(state["last_error"]); time.sleep(10); continue
        try:
            state["proc"] = subprocess.Popen(browser_args(exe))
            state["proc"].wait()
        except OSError as e:
            state["last_error"] = str(e); log("launch failed", e)
        if not state["exiting"]:
            log("browser closed without staff card — relaunching")
            time.sleep(1.5)


def open_control_page():
    exe = chrome_path()
    if exe:
        subprocess.Popen([str(exe), f"--user-data-dir={DATA_DIR / 'profile'}", f"chrome-extension://{EXTENSION_ID}/exit.html"])


def kill_browser():
    p = state.get("proc")
    if p and p.poll() is None:
        if os.name == "nt":  # whole process tree of our own browser only
            subprocess.run(["taskkill", "/F", "/T", "/PID", str(p.pid)], capture_output=True)
        else:
            p.terminate()


def power(action: str) -> bool:
    if os.name != "nt":
        log("power action skipped (not Windows)", action); return False
    cmd = {"shutdown": ["shutdown", "/s", "/t", "15", "/c", "BNG Safe Browser: ปิดเครื่องตามคำสั่ง"],
           "restart": ["shutdown", "/r", "/t", "15"], "cancel": ["shutdown", "/a"],
           "sleep": ["rundll32.exe", "powrprof.dll,SetSuspendState", "0,1,0"]}.get(action)
    if not cmd:
        return False
    return subprocess.run(cmd, capture_output=True).returncode == 0


def quit_program():
    state["exiting"] = True
    keyboard_unlock()
    kill_browser()
    log("exit authorized")
    threading.Timer(1.0, lambda: os._exit(0)).start()


# ── Local bridge for the extension (loopback + extension origin only) ─────
class Bridge(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def _send(self, code: int, body: dict):
        data = json.dumps(body, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", ALLOWED_ORIGIN)
        self.end_headers(); self.wfile.write(data)

    def _origin_ok(self) -> bool:
        return self.headers.get("Origin") == ALLOWED_ORIGIN

    def do_OPTIONS(self):
        if not self._origin_ok():
            return self._send(403, {"error": "forbidden"})
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", ALLOWED_ORIGIN)
        self.send_header("Access-Control-Allow-Methods", "GET, POST")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        if self.path != "/status" or not self._origin_ok():
            return self._send(404, {"error": "not found"})
        self._send(200, {"kiosk": KIOSK, "version": APP_VERSION, "device": bool(DEVICE_KEY)})

    def do_POST(self):
        if self.path != "/action" or not self._origin_ok():
            return self._send(404, {"error": "not found"})
        try:
            body = json.loads(self.rfile.read(min(int(self.headers.get("Content-Length", 0)), 4096)) or b"{}")
        except ValueError:
            return self._send(400, {"error": "คำสั่งไม่ถูกต้อง"})
        action, qr = body.get("action"), str(body.get("qr") or "")[:500]
        if action not in ("exit", "shutdown", "restart") or not qr:
            return self._send(400, {"error": "คำสั่งไม่ถูกต้อง"})
        code, res = cloud("staff-card", {"qr": qr, "purpose": "exit" if action == "exit" else "shutdown"})
        if code != 200 or not res.get("ok"):
            log("card denied", action, code)
            return self._send(403 if code == 403 else 502, {"error": res.get("error") or "ตรวจสอบบัตรไม่สำเร็จ"})
        log("card accepted", action, res.get("name"))
        self._send(200, {"ok": True, "name": res.get("name")})
        if action == "exit":
            quit_program()
        else:
            power(action)


# ── Heartbeat + remote power commands (shared FaceGate queue) ──────────────
def disk_free_mb() -> int:
    try:
        return shutil.disk_usage(str(APP_DIR)).free // (1024 * 1024)
    except OSError:
        return 0


def cloud_loop():
    while not state["exiting"]:
        if DEVICE_KEY:
            cloud("browser-heartbeat", {"agent_version": f"safe-browser {APP_VERSION}", "platform": "Safe Browser (Windows)",
                                        "disk_free_mb": disk_free_mb(), "health_note": state["last_error"]})
            code, res = cloud("power-command", {})
            cmd, cid = res.get("command"), res.get("command_id")
            if code == 200 and cmd and cid:
                ok = power(cmd) if cmd in ("shutdown", "cancel", "sleep") else False
                if cmd in ("screen_on", "screen_off", "live_view"):
                    ok, detail = True, "เครื่องเบราว์เซอร์ไม่มีคำสั่งนี้ ข้ามแล้ว"
                else:
                    detail = "สั่งเครื่องแล้ว" if ok else "เครื่องทำคำสั่งไม่สำเร็จ"
                cloud("command-result", {"id": cid, "status": "scheduled" if ok and cmd == "shutdown" else ("completed" if ok else "failed"), "detail": detail})
                log("remote command", cmd, ok)
        time.sleep(20)


# ── Keyboard lock (Win, Alt+Tab, Alt+F4, Ctrl+Esc, Ctrl+Shift+Esc) ─────────
_hook = None
_hook_cb = None


def keyboard_lock():
    global _hook, _hook_cb
    if os.name != "nt" or not KIOSK:
        return
    from ctypes import wintypes
    user32, kernel32 = ctypes.WinDLL("user32", use_last_error=True), ctypes.WinDLL("kernel32")

    class KBD(ctypes.Structure):
        _fields_ = [("vk", wintypes.DWORD), ("scan", wintypes.DWORD), ("flags", wintypes.DWORD),
                    ("time", wintypes.DWORD), ("extra", ctypes.c_size_t)]

    HOOKPROC = ctypes.WINFUNCTYPE(ctypes.c_ssize_t, ctypes.c_int, wintypes.WPARAM, wintypes.LPARAM)
    user32.CallNextHookEx.argtypes = [wintypes.HHOOK, ctypes.c_int, wintypes.WPARAM, wintypes.LPARAM]
    user32.CallNextHookEx.restype = ctypes.c_ssize_t
    user32.SetWindowsHookExW.argtypes = [ctypes.c_int, HOOKPROC, wintypes.HINSTANCE, wintypes.DWORD]
    user32.SetWindowsHookExW.restype = wintypes.HHOOK
    pressed = lambda vk: user32.GetAsyncKeyState(vk) & 0x8000

    def proc(n, w, l):
        if n == 0:
            k = ctypes.cast(l, ctypes.POINTER(KBD)).contents
            alt = k.flags & 0x20
            ctrl = pressed(0x11)
            if k.vk in (0x5B, 0x5C, 0x5D):  # Win keys, Apps
                return 1
            if alt and k.vk in (0x09, 0x73, 0x1B, 0x20):  # Alt+Tab/F4/Esc/Space
                return 1
            if ctrl and k.vk == 0x1B:  # Ctrl+Esc, Ctrl+Shift+Esc
                return 1
            if ctrl and pressed(0x10) and k.vk == 0x51 and w == 0x100:  # Ctrl+Shift+Q → control page
                threading.Thread(target=open_control_page, daemon=True).start(); return 1
            if k.vk == 0x7B and ctrl:  # Ctrl+F12 devtools fallback
                return 1
        return user32.CallNextHookEx(None, n, w, l)

    def run():
        global _hook, _hook_cb
        _hook_cb = HOOKPROC(proc)
        _hook = user32.SetWindowsHookExW(13, _hook_cb, kernel32.GetModuleHandleW(None), 0)
        msg = wintypes.MSG()
        while user32.GetMessageW(ctypes.byref(msg), None, 0, 0) > 0:
            pass

    threading.Thread(target=run, daemon=True).start()


def keyboard_unlock():
    if _hook and os.name == "nt":
        ctypes.WinDLL("user32").UnhookWindowsHookEx(_hook)


def single_instance() -> bool:
    if os.name != "nt":
        return True
    ctypes.WinDLL("kernel32").CreateMutexW(None, False, "Global\\BNGSafeBrowser")
    return ctypes.GetLastError() != 183


def main():
    if not single_instance():
        return
    log("start", APP_VERSION, "kiosk" if KIOSK else "window", "device" if DEVICE_KEY else "no-device-key")
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Bridge)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    threading.Thread(target=cloud_loop, daemon=True).start()
    keyboard_lock()
    browser_loop()


if __name__ == "__main__":
    main()
