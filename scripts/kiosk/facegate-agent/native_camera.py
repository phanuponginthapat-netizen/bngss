"""
Direct camera capture for FaceGate (no web browser camera).

When FACEGATE_NATIVE_CAMERA=1 the program opens the USB webcam itself
(V4L2 on Linux, DirectShow on Windows) and keeps only the newest frame in
memory. The scan screen shows that frame and asks the program to scan it,
so pictures never travel through the browser camera stack.
"""

from __future__ import annotations

import os
import sys
import threading
import time

import cv2
import numpy as np

ENABLED = os.environ.get("FACEGATE_NATIVE_CAMERA", "0").lower() in ("1", "true", "yes", "on")
INDEX = os.environ.get("FACEGATE_CAMERA_INDEX", "0")
WIDTH = int(os.environ.get("FACEGATE_CAMERA_WIDTH", "640") or 640)
HEIGHT = int(os.environ.get("FACEGATE_CAMERA_HEIGHT", "480") or 480)

_lock = threading.Lock()
_frame: np.ndarray | None = None
_frame_at = 0.0
_status = {"open": False, "error": "", "device": INDEX}
_started = False


def _open() -> cv2.VideoCapture | None:
    source: int | str = int(INDEX) if str(INDEX).isdigit() else INDEX
    backend = cv2.CAP_V4L2 if sys.platform.startswith("linux") else (
        cv2.CAP_DSHOW if sys.platform == "win32" else cv2.CAP_ANY)
    cap = cv2.VideoCapture(source, backend)
    if not cap.isOpened():
        cap.release()
        cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        cap.release()
        return None
    # MJPG keeps USB 2.0 webcams at full frame rate on low-power CPUs.
    cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*"MJPG"))
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, WIDTH)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, HEIGHT)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # always the newest picture, no lag
    return cap


def _loop() -> None:
    global _frame, _frame_at
    cap = None
    while True:
        if cap is None:
            cap = _open()
            if cap is None:
                _status.update(open=False, error="camera_not_found")
                time.sleep(2)  # unplugged → keep retrying until it comes back
                continue
            _status.update(open=True, error="")
            print(f"[camera] direct camera {INDEX} opened")
        ok, img = cap.read()
        if not ok or img is None:
            _status.update(open=False, error="read_failed")
            cap.release()
            cap = None
            time.sleep(1)
            continue
        with _lock:
            _frame, _frame_at = img, time.time()


def start() -> None:
    global _started
    if ENABLED and not _started:
        _started = True
        threading.Thread(target=_loop, daemon=True, name="native-camera").start()


def latest(rotate: int = 0, max_age: float = 2.0) -> np.ndarray | None:
    with _lock:
        img, at = _frame, _frame_at
    if img is None or time.time() - at > max_age:
        return None
    rot = int(rotate or 0) % 360
    if rot == 90:
        img = cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
    elif rot == 180:
        img = cv2.rotate(img, cv2.ROTATE_180)
    elif rot == 270:
        img = cv2.rotate(img, cv2.ROTATE_90_COUNTERCLOCKWISE)
    return img


def jpeg(rotate: int = 0, quality: int = 80) -> bytes | None:
    img = latest(rotate)
    if img is None:
        return None
    ok, buf = cv2.imencode(".jpg", img, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
    return buf.tobytes() if ok else None


def status() -> dict:
    return {"native": ENABLED, **_status, "age": round(time.time() - _frame_at, 2) if _frame_at else None}
