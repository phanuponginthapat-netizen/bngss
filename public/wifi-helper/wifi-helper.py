#!/usr/bin/env python3
"""
BNGSS Wi-Fi Helper — Native Messaging Host for Chromium extension.

Protocol: stdin/stdout with 4-byte little-endian length prefix + JSON body.
Commands from extension:
  {cmd:"list"}                       -> {ok, networks:[{ssid,signal,security,in_use}]}
  {cmd:"scan"}                       -> {ok}
  {cmd:"connect", ssid, password?}   -> {ok} | {ok:false, error}
  {cmd:"disconnect"}                 -> {ok}
  {cmd:"forget", ssid}               -> {ok}
  {cmd:"saved"}                      -> {ok, saved:[{name,autoconnect}]}
  {cmd:"status"}                     -> {ok, state, connectivity, active_ssid}
  {cmd:"ping"}                       -> {ok, pong:true, version}

All Wi-Fi connections created here are marked autoconnect=yes so they persist
across reboots (assuming /etc/NetworkManager/system-connections is not wiped
by Deep Freeze — see setup.sh for exclusion path).
"""
import json
import struct
import subprocess
import sys

VERSION = "1.0.0"


def read_message():
    raw_len = sys.stdin.buffer.read(4)
    if len(raw_len) < 4:
        return None
    (n,) = struct.unpack("<I", raw_len)
    data = sys.stdin.buffer.read(n)
    return json.loads(data.decode("utf-8"))


def send_message(obj):
    data = json.dumps(obj, ensure_ascii=False).encode("utf-8")
    sys.stdout.buffer.write(struct.pack("<I", len(data)))
    sys.stdout.buffer.write(data)
    sys.stdout.buffer.flush()


def run(args, timeout=25):
    try:
        p = subprocess.run(
            args, capture_output=True, text=True, timeout=timeout, check=False
        )
        return p.returncode, p.stdout.strip(), p.stderr.strip()
    except subprocess.TimeoutExpired:
        return 124, "", "timeout"
    except FileNotFoundError as e:
        return 127, "", str(e)


def nmcli_list():
    # -t terse, escape colons with \: (nmcli does that automatically)
    code, out, err = run(
        ["nmcli", "-t", "-f", "IN-USE,SSID,SIGNAL,SECURITY", "device", "wifi", "list"]
    )
    if code != 0:
        return {"ok": False, "error": err or "nmcli failed"}
    seen = {}
    for line in out.splitlines():
        # Fields separated by ':' but SSID may contain '\:'
        # Simple state machine parse:
        fields, buf, esc = [], "", False
        for ch in line:
            if esc:
                buf += ch
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == ":":
                fields.append(buf)
                buf = ""
            else:
                buf += ch
        fields.append(buf)
        if len(fields) < 4:
            continue
        in_use, ssid, signal, sec = fields[0], fields[1], fields[2], fields[3]
        if not ssid:
            continue
        try:
            sig = int(signal)
        except ValueError:
            sig = 0
        prev = seen.get(ssid)
        if prev is None or sig > prev["signal"]:
            seen[ssid] = {
                "ssid": ssid,
                "signal": sig,
                "security": sec or "--",
                "in_use": in_use == "*",
            }
    nets = sorted(seen.values(), key=lambda n: (-n["signal"], n["ssid"]))
    return {"ok": True, "networks": nets}


def nmcli_scan():
    run(["nmcli", "device", "wifi", "rescan"], timeout=15)
    return {"ok": True}


def nmcli_connect(ssid, password):
    if not ssid:
        return {"ok": False, "error": "missing ssid"}
    args = ["nmcli", "device", "wifi", "connect", ssid]
    if password:
        args += ["password", password]
    code, out, err = run(args, timeout=45)
    if code != 0:
        return {"ok": False, "error": err or out or "connect failed"}
    # ensure autoconnect=yes so it survives reboot
    run(
        ["nmcli", "connection", "modify", ssid, "connection.autoconnect", "yes"],
        timeout=10,
    )
    return {"ok": True}


def nmcli_disconnect():
    code, out, err = run(["nmcli", "-t", "-f", "DEVICE,TYPE", "device"])
    if code != 0:
        return {"ok": False, "error": err or "nmcli device failed"}
    for line in out.splitlines():
        parts = line.split(":")
        if len(parts) >= 2 and parts[1] == "wifi":
            run(["nmcli", "device", "disconnect", parts[0]], timeout=15)
    return {"ok": True}


def nmcli_forget(ssid):
    if not ssid:
        return {"ok": False, "error": "missing ssid"}
    code, out, err = run(["nmcli", "connection", "delete", ssid], timeout=15)
    if code != 0:
        return {"ok": False, "error": err or "delete failed"}
    return {"ok": True}


def nmcli_saved():
    code, out, err = run(
        [
            "nmcli",
            "-t",
            "-f",
            "NAME,TYPE,AUTOCONNECT",
            "connection",
            "show",
        ]
    )
    if code != 0:
        return {"ok": False, "error": err or "nmcli failed"}
    saved = []
    for line in out.splitlines():
        parts = line.split(":")
        if len(parts) >= 3 and "wireless" in parts[1]:
            saved.append(
                {"name": parts[0], "autoconnect": parts[2].lower() == "yes"}
            )
    return {"ok": True, "saved": saved}


def nmcli_status():
    code, out, _ = run(["nmcli", "-t", "-f", "STATE,CONNECTIVITY", "general"])
    state, conn = "unknown", "unknown"
    if code == 0 and out:
        parts = out.splitlines()[0].split(":")
        if len(parts) >= 2:
            state, conn = parts[0], parts[1]
    active_ssid = ""
    code2, out2, _ = run(
        ["nmcli", "-t", "-f", "ACTIVE,SSID", "device", "wifi", "list"]
    )
    if code2 == 0:
        for line in out2.splitlines():
            if line.startswith("yes:"):
                active_ssid = line.split(":", 1)[1]
                break
    return {
        "ok": True,
        "state": state,
        "connectivity": conn,
        "active_ssid": active_ssid,
    }


def handle(msg):
    cmd = (msg or {}).get("cmd")
    if cmd == "ping":
        return {"ok": True, "pong": True, "version": VERSION}
    if cmd == "list":
        return nmcli_list()
    if cmd == "scan":
        return nmcli_scan()
    if cmd == "connect":
        return nmcli_connect(msg.get("ssid", ""), msg.get("password", ""))
    if cmd == "disconnect":
        return nmcli_disconnect()
    if cmd == "forget":
        return nmcli_forget(msg.get("ssid", ""))
    if cmd == "saved":
        return nmcli_saved()
    if cmd == "status":
        return nmcli_status()
    return {"ok": False, "error": f"unknown cmd: {cmd}"}


def main():
    while True:
        try:
            msg = read_message()
        except Exception as e:
            send_message({"ok": False, "error": f"parse: {e}"})
            return
        if msg is None:
            return
        try:
            send_message(handle(msg))
        except Exception as e:
            send_message({"ok": False, "error": f"handler: {e}"})


if __name__ == "__main__":
    main()
