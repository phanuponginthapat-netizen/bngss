"""Student-card QR fallback for FaceGate.

When a face is hard to recognise, a student can hold the QR on their student
card up to the same camera. The card QR holds only the student code, so a QR
is accepted only when its text is exactly a code the kiosk already knows —
LINE-link QRs, URLs or anything else on the card are ignored.
"""
from __future__ import annotations

import time

import cv2
import numpy as np

_detector = cv2.QRCodeDetector()


def build_code_index(people: dict) -> dict[str, str]:
    """student_code -> person id, for active people synced from the school."""
    index: dict[str, str] = {}
    for pid, person in (people or {}).items():
        code = str((person or {}).get("student_code") or "").strip()
        if code:
            index[code] = pid
    return index


def match_card(text: str | None, index: dict[str, str]) -> str | None:
    """Return the person id only when the QR text is exactly a known code."""
    if not text:
        return None
    value = text.strip()
    if not value or len(value) > 32 or any(ch.isspace() for ch in value):
        return None
    return index.get(value)


def read_qr(bgr: np.ndarray) -> str | None:
    """Decode one QR from a camera frame (raw, then contrast-boosted)."""
    if bgr is None or bgr.size == 0:
        return None
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY) if bgr.ndim == 3 else bgr
    for img in (gray, cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(gray)):
        try:
            text, points, _ = _detector.detectAndDecode(img)
        except cv2.error:
            continue
        if text:
            return text
    return None


class RepeatGuard:
    """Stops one card held in front of the camera from posting every frame."""

    def __init__(self, hold_s: float = 6.0):
        self.hold_s = hold_s
        self._last: dict[str, float] = {}

    def allow(self, person_id: str, now: float | None = None) -> bool:
        now = time.time() if now is None else now
        last = self._last.get(person_id)
        if last is not None and now - last < self.hold_s:
            return False
        self._last[person_id] = now
        return True


def frame_evidence_jpeg(bgr: np.ndarray, max_h: int = 480) -> bytes | None:
    """Whole-frame photo kept for teachers to check who held the card."""
    img = bgr
    if img.shape[0] > max_h:
        scale = max_h / img.shape[0]
        img = cv2.resize(img, (int(img.shape[1] * scale), max_h))
    ok, buf = cv2.imencode(".jpg", img, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
    return buf.tobytes() if ok else None
