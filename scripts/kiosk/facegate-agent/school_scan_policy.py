"""Cloud school scan windows, mirrored from schoolScanPolicy.ts."""
from datetime import datetime, timezone, timedelta
import re

def evaluate_school_scan(settings, direction=None, now=None):
    now = now or datetime.now(timezone(timedelta(hours=7)))
    now = now.astimezone(timezone(timedelta(hours=7)))
    minutes = now.hour * 60 + now.minute
    def minute(raw):
        match = re.fullmatch(r"([01]?\d|2[0-3]):([0-5]\d)", str(raw))
        if not match:
            raise ValueError("Invalid school scan time")
        return int(match[1]) * 60 + int(match[2])
    direction = direction or ("in" if minutes < minute(settings.get("face_scan_mode_cutoff", "12:00")) else "out")
    raw = settings.get("face_scan_entry_window" if direction == "in" else "face_scan_exit_window")
    if raw is None or raw == "":
        return {"allowed": True, "direction": direction, "reason": ""}
    match = re.fullmatch(r"(\d{1,2}:\d{2})\s*[-–~]\s*(\d{1,2}:\d{2})", str(raw).strip())
    if not match:
        raise ValueError("Invalid school scan window")
    start, end = minute(match[1]), minute(match[2])
    if end <= start:
        raise ValueError("Invalid school scan window")
    allowed = start <= minutes < end
    label = "เข้า" if direction == "in" else "ออก"
    return {"allowed": allowed, "direction": direction, "reason": "" if allowed else f"นอกช่วงเวลาสแกน{label} ({match[1]}–{match[2]} น.)"}