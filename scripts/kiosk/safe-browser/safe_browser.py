"""BNG Safe Browser for Windows — kiosk launcher.

Runs a bundled Chromium (Chrome for Testing) full-screen with the school Safe Browser
extension, relaunches it if closed, blocks common escape keys, and only quits or powers
off after the school server confirms a staff/admin card QR. The staff-card control page
is served by this launcher on 127.0.0.1 only (other machines on the network get 404).

Device Key is optional: student loaner notebooks run without it. A machine can be
registered later from the control page by scanning an admin/director card, which
creates the device on the school server and stores the key locally; registered
machines then report heartbeat and accept remote power commands through the shared
FaceGate power-command queue.
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

import exit_page

APP_VERSION = "1.6.0"
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
KIOSK = CFG.get("SAFEBROWSER_KIOSK", "1") != "0"
# auto = ใช้ Chrome ปกติของเครื่องถ้ามี (ส่วนขยายที่ติดตั้งจาก ZIP อยู่ในโปรไฟล์ปกติ) ไม่งั้นใช้ตัวที่แถมมา
BROWSER_MODE = CFG.get("SAFEBROWSER_BROWSER", "auto").strip().lower()


def load_device_key() -> str:
    """Installer env wins; otherwise the key stored by in-program registration."""
    key = CFG.get("SAFEBROWSER_DEVICE_KEY", "").strip()
    if key:
        return key
    try:
        return (DATA_DIR / "device.key").read_text(encoding="utf-8").strip()
    except OSError:
        return ""


DEVICE_KEY = load_device_key()

state = {"exiting": False, "proc": None, "last_error": "", "ext_ping": 0.0, "browser_start": 0.0}


def log(*a):
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        with open(DATA_DIR / "safe-browser.log", "a", encoding="utf-8") as f:
            f.write(time.strftime("%Y-%m-%d %H:%M:%S ") + " ".join(map(str, a)) + "\n")
    except OSError:
        pass


def cloud(route: str, body: dict, timeout: float = 15) -> tuple[int, dict]:
    headers = {"Content-Type": "application/json"}
    if DEVICE_KEY:
        headers["x-device-key"] = DEVICE_KEY
    elif route not in ("staff-card-check", "register-device-card"):
        return 0, {"error": "ยังไม่ได้ลงทะเบียนเครื่อง (ไม่มี Device Key)"}
    req = urllib.request.Request(f"{CLOUD_URL}/kiosk-api/{route}", data=json.dumps(body).encode(),
                                 headers=headers, method="POST")
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
def system_chrome() -> Path | None:
    roots = [os.environ.get(k) for k in ("PROGRAMFILES", "PROGRAMFILES(X86)", "LOCALAPPDATA")]
    for r in roots:
        if r:
            p = Path(r) / "Google" / "Chrome" / "Application" / "chrome.exe"
            if p.exists():
                return p
    return None


def bundled_chrome() -> Path | None:
    for p in (APP_DIR / "chrome" / "chrome.exe", BASE / "chrome" / "chrome.exe"):
        if p.exists():
            return p
    return None


def chrome_path() -> Path | None:
    if BROWSER_MODE == "bundled":
        return bundled_chrome()
    if BROWSER_MODE == "system":
        return system_chrome()
    return system_chrome() or bundled_chrome()


def is_system(exe: Path) -> bool:
    return exe == system_chrome()


def profile_args(exe: Path) -> list[str]:
    # Chrome ปกติใช้โปรไฟล์ปกติของผู้ใช้ เพื่อให้ส่วนขยายที่ติดตั้งจาก ZIP ทำงาน
    return [] if is_system(exe) else [f"--user-data-dir={DATA_DIR / 'profile'}"]


def close_running_chrome():
    """Chrome ปกติที่เปิดค้างไว้จะรับคำสั่งแทนแล้วโปรแกรมนี้คุมไม่ได้ จึงปิดก่อนเปิดโหมด kiosk"""
    if os.name == "nt":
        subprocess.run(["taskkill", "/F", "/IM", "chrome.exe"], capture_output=True)
        time.sleep(1)


def browser_args(exe: Path) -> list[str]:
    ext = APP_DIR / "extension"
    args = [str(exe), *profile_args(exe)]
    if not is_system(exe):
        args += [f"--load-extension={ext}", f"--disable-extensions-except={ext}"]
    args += ["--no-first-run", "--no-default-browser-check",
            "--disable-session-crashed-bubble", "--disable-infobars", "--noerrdialogs",
            "--disable-features=Translate,DownloadBubble,DisableLoadExtensionCommandLineSwitch", "--use-fake-ui-for-media-stream",
            "--autoplay-policy=no-user-gesture-required", "--disable-dev-tools", "--disable-print-preview"]
    if KIOSK:
        # ให้หน้า Monitor Agent จับจอ/แชร์จอได้โดยไม่ขึ้น dialog เลือกจอ
        args += ["--kiosk", "--start-fullscreen",
                 "--auto-select-desktop-capture-source=Entire screen"]
    return args + [HOME_URL]


def browser_loop():
    while not state["exiting"]:
        exe = chrome_path()
        if not exe:
            state["last_error"] = "ไม่พบเบราว์เซอร์ในโฟลเดอร์โปรแกรม"
            log(state["last_error"]); time.sleep(10); continue
        try:
            if is_system(exe):
                close_running_chrome()
            log("launch", exe)
            state["browser_start"] = time.time()
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
        subprocess.Popen([str(exe), *profile_args(exe), f"http://127.0.0.1:{PORT}/exit"])


_last_prompt = [0.0]


def request_exit_card(reason: str):
    """Any attempt to leave (Start, Alt+F4, log off, power button) opens the staff-card page."""
    if state["exiting"] or time.time() - _last_prompt[0] < 3:
        return
    _last_prompt[0] = time.time()
    log("exit attempt blocked:", reason)
    threading.Thread(target=open_control_page, daemon=True).start()


POLICY_KEYS = {  # HKCU policies: hide Task Manager / lock / log off / sign-out paths while kiosk runs
    r"Software\Microsoft\Windows\CurrentVersion\Policies\System": ("DisableTaskMgr", "DisableLockWorkstation", "DisableChangePassword", "DisableSwitchUserOption"),
    r"Software\Microsoft\Windows\CurrentVersion\Policies\Explorer": ("NoLogoff", "NoClose", "StartMenuLogOff"),
}


def set_lock_policies(on: bool):
    if os.name != "nt" or not KIOSK:
        return
    import winreg
    for path, names in POLICY_KEYS.items():
        try:
            with winreg.CreateKeyEx(winreg.HKEY_CURRENT_USER, path, 0, winreg.KEY_SET_VALUE) as key:
                for n in names:
                    if on:
                        winreg.SetValueEx(key, n, 0, winreg.REG_DWORD, 1)
                    else:
                        try: winreg.DeleteValue(key, n)
                        except OSError: pass
        except OSError as e:
            log("policy write failed", path, e)


BLOCKED_APPS = {"taskmgr.exe", "procexp.exe", "procexp64.exe", "processhacker.exe", "systeminformer.exe",
                "cmd.exe", "powershell.exe", "pwsh.exe", "regedit.exe", "mmc.exe", "resmon.exe", "perfmon.exe"}


def taskmgr_watchdog():
    """Ctrl+Alt+Del cannot be intercepted; instead close Task Manager/system tools at once and return to the browser."""
    if os.name != "nt" or not KIOSK:
        return
    from ctypes import wintypes
    k32 = ctypes.WinDLL("kernel32", use_last_error=True)
    user32 = ctypes.WinDLL("user32", use_last_error=True)

    class PE(ctypes.Structure):
        _fields_ = [("dwSize", wintypes.DWORD), ("cntUsage", wintypes.DWORD), ("pid", wintypes.DWORD),
                    ("heap", ctypes.c_void_p), ("mod", wintypes.DWORD), ("threads", wintypes.DWORD),
                    ("ppid", wintypes.DWORD), ("prio", ctypes.c_long), ("flags", wintypes.DWORD),
                    ("exe", ctypes.c_wchar * 260)]
    k32.CreateToolhelp32Snapshot.restype = wintypes.HANDLE
    k32.OpenProcess.restype = wintypes.HANDLE
    me = os.getpid()

    def focus_browser():
        found = []
        CB = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
        def each(h, _):
            buf = ctypes.create_unicode_buffer(64); user32.GetClassNameW(h, buf, 64)
            if buf.value.startswith("Chrome_WidgetWin_1") and user32.IsWindowVisible(h):
                found.append(h); return False
            return True
        user32.EnumWindows(CB(each), 0)
        if found:
            user32.keybd_event(0x12, 0, 0, 0); user32.keybd_event(0x12, 0, 2, 0)  # allow foreground switch
            user32.ShowWindow(found[0], 3); user32.SetForegroundWindow(found[0])

    def run():
        while not state["exiting"]:
            killed = False
            snap = k32.CreateToolhelp32Snapshot(2, 0)
            pe = PE(); pe.dwSize = ctypes.sizeof(PE)
            ok = k32.Process32FirstW(snap, ctypes.byref(pe))
            while ok:
                if pe.exe.lower() in BLOCKED_APPS and pe.pid != me:
                    h = k32.OpenProcess(0x0001, False, pe.pid)  # PROCESS_TERMINATE
                    if h:
                        if k32.TerminateProcess(h, 1):
                            killed = True; log("closed blocked app", pe.exe)
                        k32.CloseHandle(h)
                ok = k32.Process32NextW(snap, ctypes.byref(pe))
            k32.CloseHandle(snap)
            if killed and not state["exiting"]:
                focus_browser()
                request_exit_card("task manager")
            time.sleep(0.3)

    threading.Thread(target=run, daemon=True).start()


def session_guard():
    """Hidden window that vetoes log off / shutdown / power-button requests unless a staff card authorized them."""
    if os.name != "nt" or not KIOSK:
        return
    from ctypes import wintypes
    user32 = ctypes.WinDLL("user32", use_last_error=True)
    WNDPROC = ctypes.WINFUNCTYPE(ctypes.c_ssize_t, wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM)
    user32.DefWindowProcW.argtypes = [wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM]
    user32.DefWindowProcW.restype = ctypes.c_ssize_t

    class WNDCLASS(ctypes.Structure):
        _fields_ = [("style", wintypes.UINT), ("proc", WNDPROC), ("cls", ctypes.c_int), ("wnd", ctypes.c_int),
                    ("inst", wintypes.HINSTANCE), ("icon", wintypes.HANDLE), ("cursor", wintypes.HANDLE),
                    ("bg", wintypes.HANDLE), ("menu", wintypes.LPCWSTR), ("name", wintypes.LPCWSTR)]

    def proc(h, m, w, l):
        if m == 0x11 and not state["exiting"] and not state.get("power_ok"):  # WM_QUERYENDSESSION
            request_exit_card("end session")
            return 0  # veto
        return user32.DefWindowProcW(h, m, w, l)

    def run():
        cb = WNDPROC(proc); state["_guard_cb"] = cb
        wc = WNDCLASS(); wc.proc = cb; wc.name = "BNGSafeBrowserGuard"
        wc.inst = ctypes.WinDLL("kernel32").GetModuleHandleW(None)
        user32.RegisterClassW(ctypes.byref(wc))
        hwnd = user32.CreateWindowExW(0, "BNGSafeBrowserGuard", "BNG Safe Browser", 0, 0, 0, 0, 0, None, None, wc.inst, None)
        try:
            user32.ShutdownBlockReasonCreate(hwnd, "ต้องสแกนบัตรบุคลากรก่อนออกจากโปรแกรม")
            ctypes.WinDLL("kernel32").SetProcessShutdownParameters(0x4FF, 0)  # asked first
        except Exception as e:
            log("block reason failed", e)
        msg = wintypes.MSG()
        while user32.GetMessageW(ctypes.byref(msg), None, 0, 0) > 0:
            user32.TranslateMessage(ctypes.byref(msg)); user32.DispatchMessageW(ctypes.byref(msg))

    threading.Thread(target=run, daemon=True).start()


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
    if action in ("shutdown", "restart"):
        state["power_ok"] = True; set_lock_policies(False)
    elif action == "cancel":
        state["power_ok"] = False
    return subprocess.run(cmd, capture_output=True).returncode == 0


def quit_program():
    state["exiting"] = True
    keyboard_unlock()
    set_lock_policies(False)
    kill_browser()
    log("exit authorized")
    threading.Timer(1.0, lambda: os._exit(0)).start()


def verify_card(qr: str, purpose: str) -> tuple[int, dict]:
    """Staff-card check: with a device key via staff-card, otherwise the public check route."""
    if DEVICE_KEY:
        return cloud("staff-card", {"qr": qr, "purpose": purpose})
    return cloud("staff-card-check", {"qr": qr})


def register_device(qr: str, name: str) -> tuple[int, dict]:
    global DEVICE_KEY
    code, res = cloud("register-device-card", {"qr": qr, "name": name})
    if code == 200 and res.get("ok") and res.get("device_key"):
        DEVICE_KEY = str(res["device_key"])
        try:
            DATA_DIR.mkdir(parents=True, exist_ok=True)
            (DATA_DIR / "device.key").write_text(DEVICE_KEY, encoding="utf-8")
        except OSError as e:
            log("device key save failed", e)
        log("device registered as", name)
    return code, res


# ── Local server: extension bridge + staff-card control page ──────────────
class Bridge(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def _send(self, code: int, body: dict):
        data = json.dumps(body, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", ALLOWED_ORIGIN)
        self.end_headers(); self.wfile.write(data)

    def _send_html(self, code: int, data: bytes, content_type: str = "text/html; charset=utf-8"):
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store")
        self.end_headers(); self.wfile.write(data)

    def _origin_ok(self) -> bool:
        return self.headers.get("Origin") == ALLOWED_ORIGIN

    def _local_ok(self) -> bool:
        """Control page is served only to a browser on this very machine."""
        host = (self.headers.get("Host") or "").split(":")[0].lower()
        return self.client_address[0] == "127.0.0.1" and host in ("127.0.0.1", "localhost")

    def _body(self) -> dict:
        try:
            return json.loads(self.rfile.read(min(int(self.headers.get("Content-Length", 0)), 4096)) or b"{}")
        except ValueError:
            return {}

    def do_OPTIONS(self):
        if not self._origin_ok():
            return self._send(403, {"error": "forbidden"})
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", ALLOWED_ORIGIN)
        self.send_header("Access-Control-Allow-Methods", "GET, POST")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        if self.path == "/status" and self._origin_ok():
            state["ext_ping"] = time.time()
            return self._send(200, {"kiosk": KIOSK, "version": APP_VERSION, "device": bool(DEVICE_KEY)})
        if self.path == "/exit" and self._local_ok():
            return self._send_html(200, exit_page.render(APP_VERSION, KIOSK, bool(DEVICE_KEY)))
        if self.path == "/jsqr.js" and self._local_ok():
            jsqr = APP_DIR / "extension" / "jsQR.js"
            if jsqr.exists():
                return self._send_html(200, jsqr.read_bytes(), "application/javascript; charset=utf-8")
        self._send(404, {"error": "not found"})

    def do_POST(self):
        if self.path == "/verify" and self._local_ok():
            body = self._body()
            action, qr = body.get("action"), str(body.get("qr") or "")[:500]
            if action not in ("exit", "shutdown", "restart") or not qr:
                return self._send(400, {"error": "คำสั่งไม่ถูกต้อง"})
            code, res = verify_card(qr, "exit" if action == "exit" else "shutdown")
            if code != 200 or not res.get("ok"):
                log("card denied", action, code)
                return self._send(403 if code == 403 else 502, {"error": res.get("error") or "ตรวจสอบบัตรไม่สำเร็จ"})
            log("card accepted", action, res.get("name"))
            self._send(200, {"ok": True, "name": res.get("name")})
            if action == "exit":
                quit_program()
            else:
                power(action)
            return
        if self.path == "/power" and self._origin_ok():
            # ครูสั่ งจากหน้า Monitor Agent → extension เป็ นผ้ยู ้าง (origin ตองเป็ น extension เทานั้ น)
            action = str(self._body().get("action") or "")
            if action not in ("shutdown", "restart", "sleep", "cancel"):
                return self._send(400, {"error": "คำสั่ งไม่ถูกต้อง"})
            ok = power(action)
            log("extension power command", action, ok)
            return self._send(200 if ok else 502, {"ok": ok, "error": None if ok else "เครื่องทำคำสั่ งไม่สำเร็จ"})
        if self.path == "/register-local" and self._local_ok():
            body = self._body()
            qr, name = str(body.get("qr") or "")[:500], str(body.get("name") or "").strip()[:60]
            if not qr or not name:
                return self._send(400, {"error": "กรุณาตั้งชื่อเครื่องและสแกนบัตร"})
            code, res = register_device(qr, name)
            if code != 200 or not res.get("ok"):
                log("register denied", code)
                return self._send(403 if code == 403 else 502, {"error": res.get("error") or "ลงทะเบียนไม่สำเร็จ"})
            return self._send(200, {"ok": True})
        self._send(404, {"error": "not found"})


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
                action = {"reboot": "restart"}.get(cmd, cmd)
                ok = power(action) if action in ("shutdown", "cancel", "sleep", "restart") else False
                if cmd == "live_view":
                    ok, detail = True, "หน้า Monitor Agent แสด่งจอให้แล้ว"
                elif cmd in ("screen_on", "screen_off"):
                    ok, detail = False, "เครื่องเบราว์เซอร์ไม่มีคำสั่ งน้ี"
                else:
                    detail = "สั่ งเครื่ องแล้ว" if ok else "เครื่ องทำคำสั่ งไม่ สำเร็จ"
                cloud("command-result", {"id": cid, "status": "scheduled" if ok and action in ("shutdown", "restart") else ("completed" if ok else "failed"), "detail": detail})
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
            down = w in (0x100, 0x104)
            # Start/Win, Apps, Alt+F4/Tab/Esc/Space, Ctrl+Esc, Ctrl+W/Q, sleep/power keys,
            # Ctrl+Shift+Q: block and ask for a staff card instead of leaving the program.
            exit_try = (k.vk in (0x5B, 0x5C, 0x5D, 0x5F)
                        or (alt and k.vk in (0x09, 0x73, 0x1B, 0x20))
                        or (ctrl and k.vk in (0x1B, 0x57, 0x51))
                        or (ctrl and pressed(0x10) and k.vk == 0x51))
            if exit_try:
                if down:
                    request_exit_card("key %d" % k.vk)
                return 1
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


def extension_watchdog():
    """Without the school extension the browser is just an unfiltered full-screen window
    (no login enforcement, filters, toolbar, monitor). Restart the browser when the
    extension has not contacted the launcher within 60 seconds of a launch."""
    def run():
        while not state["exiting"]:
            time.sleep(15)
            started = state["browser_start"]
            if not started or time.time() - started < 60 or state["ext_ping"] >= started:
                continue
            state["last_error"] = "ส่วนขยายของโรงเรียนไม่ทำงาน — กำลังเปิดเบราว์เซอร์ใหม่"
            log(state["last_error"], "extension dir exists:", (APP_DIR / "extension" / "manifest.json").exists())
            proc = state["proc"]
            if proc and proc.poll() is None:
                proc.terminate()
    threading.Thread(target=run, daemon=True).start()


def main():
    if not single_instance():
        return
    log("start", APP_VERSION, "kiosk" if KIOSK else "window", "device" if DEVICE_KEY else "no-device-key")
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Bridge)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    threading.Thread(target=cloud_loop, daemon=True).start()
    set_lock_policies(True)
    session_guard()
    taskmgr_watchdog()
    keyboard_lock()
    extension_watchdog()
    browser_loop()


if __name__ == "__main__":
    main()
