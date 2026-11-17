"""BNGSS Wi-Fi Helper for Windows — Chrome Native Messaging host (com.bngss.wifi).

Same message protocol as public/wifi-helper/wifi-helper.py (Linux/nmcli), backed by netsh wlan.
Chrome starts this exe hidden; only the school extension ID is allowed by the host manifest.
netsh field names are localized (Thai Windows), so parsing relies on unlocalized parts only:
"SSID n :" lines, "%" signal values and the interface "SSID :" line.
"""
from __future__ import annotations

import json
import os
import re
import struct
import subprocess
import sys
import tempfile
from xml.sax.saxutils import escape

VERSION = "1.1.0"
NO_WINDOW = 0x08000000


def read_message():
    raw = sys.stdin.buffer.read(4)
    if len(raw) < 4:
        return None
    (n,) = struct.unpack("<I", raw)
    if n > 65536:
        raise ValueError("message too large")
    return json.loads(sys.stdin.buffer.read(n).decode("utf-8"))


def send_message(obj):
    data = json.dumps(obj, ensure_ascii=False).encode("utf-8")
    sys.stdout.buffer.write(struct.pack("<I", len(data)) + data)
    sys.stdout.buffer.flush()


def netsh(*args, timeout=25):
    try:
        p = subprocess.run(["netsh", "wlan", *args], capture_output=True, timeout=timeout,
                           creationflags=NO_WINDOW if os.name == "nt" else 0)
        enc = "oem" if os.name == "nt" else "utf-8"
        out = p.stdout.decode(enc, errors="replace").strip()
        return p.returncode, out
    except subprocess.TimeoutExpired:
        return 124, "timeout"
    except FileNotFoundError as e:
        return 127, str(e)


def _value(line: str) -> str:
    return line.split(":", 1)[1].strip() if ":" in line else ""


def current_ssid() -> str:
    code, out = netsh("show", "interfaces")
    if code != 0:
        return ""
    for line in out.splitlines():
        if re.match(r"^\s*SSID\s*:", line):
            return _value(line)
    return ""


def parse_networks(out: str, active: str):
    nets, cur = {}, None
    for line in out.splitlines():
        m = re.match(r"^SSID\s+\d+\s*:(.*)$", line.strip())
        if m:
            cur = {"ssid": m.group(1).strip(), "signal": 0, "security": "--", "in_use": False}
            if cur["ssid"]:
                prev = nets.get(cur["ssid"])
                nets[cur["ssid"]] = prev or cur
                cur = nets[cur["ssid"]]
            continue
        if not cur or not cur["ssid"]:
            continue
        v = _value(line)
        pm = re.match(r"^(\d{1,3})\s*%$", v)
        if pm:
            cur["signal"] = max(cur["signal"], int(pm.group(1)))
        elif re.match(r"^(Open|WPA|WEP|Shared|OWE)", v, re.I) and cur["security"] == "--":
            cur["security"] = "" if v.lower().startswith("open") else v
    for n in nets.values():
        n["in_use"] = bool(active) and n["ssid"] == active
    return sorted(nets.values(), key=lambda n: (-n["signal"], n["ssid"]))


def wifi_list():
    code, out = netsh("show", "networks", "mode=bssid")
    if code != 0:
        return {"ok": False, "error": out or "netsh failed"}
    return {"ok": True, "networks": parse_networks(out, current_ssid())}


def saved_profiles() -> list[str]:
    code, out = netsh("show", "profiles")
    if code != 0:
        return []
    names = []
    for line in out.splitlines():
        if ":" in line and line.startswith("    ") and _value(line):
            names.append(_value(line))
    return names


def profile_xml(ssid: str, password: str) -> str:
    s = escape(ssid)
    hexname = ssid.encode("utf-8").hex().upper()
    if password:
        security = (f"<authEncryption><authentication>WPA2PSK</authentication><encryption>AES</encryption>"
                    f"<useOneX>false</useOneX></authEncryption><sharedKey><keyType>passPhrase</keyType>"
                    f"<protected>false</protected><keyMaterial>{escape(password)}</keyMaterial></sharedKey>")
    else:
        security = ("<authEncryption><authentication>open</authentication><encryption>none</encryption>"
                    "<useOneX>false</useOneX></authEncryption>")
    return (f'<?xml version="1.0"?><WLANProfile xmlns="http://www.microsoft.com/networking/WLAN/profile/v1">'
            f"<name>{s}</name><SSIDConfig><SSID><hex>{hexname}</hex><name>{s}</name></SSID></SSIDConfig>"
            f"<connectionType>ESS</connectionType><connectionMode>auto</connectionMode>"
            f"<MSM><security>{security}</security></MSM></WLANProfile>")


def wifi_connect(ssid: str, password: str):
    if not ssid:
        return {"ok": False, "error": "missing ssid"}
    if password or ssid not in saved_profiles():
        fd, path = tempfile.mkstemp(suffix=".xml")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                f.write(profile_xml(ssid, password))
            code, out = netsh("add", "profile", f"filename={path}", "user=current")
            if code != 0:
                return {"ok": False, "error": out or "add profile failed"}
        finally:
            try: os.remove(path)
            except OSError: pass
    code, out = netsh("connect", f"name={ssid}", f"ssid={ssid}", timeout=45)
    return {"ok": code == 0, "error": None if code == 0 else (out or "connect failed")}


def handle(msg):
    cmd = (msg or {}).get("cmd")
    if cmd == "ping":
        return {"ok": True, "pong": True, "version": VERSION, "platform": "windows"}
    if cmd == "list":
        return wifi_list()
    if cmd == "scan":
        return {"ok": True, "error": None}  # Windows scans by itself; list returns fresh results
    if cmd == "connect":
        return wifi_connect(str(msg.get("ssid", ""))[:64], str(msg.get("password", ""))[:128])
    if cmd == "disconnect":
        code, out = netsh("disconnect")
        return {"ok": code == 0, "error": None if code == 0 else out}
    if cmd == "forget":
        ssid = str(msg.get("ssid", ""))[:64]
        if not ssid:
            return {"ok": False, "error": "missing ssid"}
        code, out = netsh("delete", "profile", f"name={ssid}")
        return {"ok": code == 0, "error": None if code == 0 else out}
    if cmd == "saved":
        return {"ok": True, "saved": [{"name": n, "autoconnect": True} for n in saved_profiles()]}
    if cmd == "status":
        ssid = current_ssid()
        return {"ok": True, "state": "connected" if ssid else "disconnected",
                "connectivity": "full" if ssid else "none", "active_ssid": ssid}
    if cmd == "power":
        # สำรองเมื่อ launcher ไม่ตอบ: ครูสั่งปิด/รีสตาร์ทผ่านส่วนขยาย (host อนุญาตเฉพาะ extension ID ของโรงเรียน)
        args = {"shutdown": ["/s", "/t", "15", "/c", "BNG Safe Browser: ปิดเครื่องตามคำสั่งครู"],
                "restart": ["/r", "/t", "15"], "cancel": ["/a"]}.get(str(msg.get("action", "")))
        if not args:
            return {"ok": False, "error": "bad action"}
        r = subprocess.run(["shutdown", *args], capture_output=True, creationflags=NO_WINDOW)
        return {"ok": r.returncode == 0, "error": None if r.returncode == 0 else "shutdown failed"}
    return {"ok": False, "error": f"unknown cmd: {cmd}"}


def main():
    while True:
        try:
            msg = read_message()
        except Exception as e:
            send_message({"ok": False, "error": f"parse: {e}"}); return
        if msg is None:
            return
        try:
            send_message(handle(msg))
        except Exception as e:
            send_message({"ok": False, "error": f"handler: {e}"})


if __name__ == "__main__":
    main()
