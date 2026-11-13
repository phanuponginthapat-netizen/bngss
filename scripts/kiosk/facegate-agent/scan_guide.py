"""Visible rectangular scan boundary and the fixed queue pause (no CV dependency)."""

NEXT_PERSON_SECONDS = 2
INSIDE_RATIO = 0.7
DEFAULT_GUIDE = (0.28, 0.25, 0.72, 0.75)


def guide_bounds(raw=None):
    import math
    if raw is None:
        return DEFAULT_GUIDE
    try:
        values = tuple(float(raw[k]) for k in ("left", "top", "right", "bottom"))
        left, top, right, bottom = values
        if all(math.isfinite(v) for v in values) and 0 <= left < right <= 1 and 0 <= top < bottom <= 1:
            return values
    except (TypeError, ValueError, KeyError):
        pass
    return None  # An invalid displayed boundary must never widen scanning.


def face_inside(box, width, height, guide=None):
    bounds = guide_bounds(guide)
    if bounds is None or width <= 0 or height <= 0:
        return False
    left, top, right, bottom = bounds
    x1, y1, x2, y2 = (float(v) for v in box[:4])
    if x2 <= x1 or y2 <= y1:
        return False
    gx1, gy1, gx2, gy2 = left * width, top * height, right * width, bottom * height
    cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
    if not (gx1 <= cx <= gx2 and gy1 <= cy <= gy2):
        return False
    # Detector boxes include forehead/chin padding, so demand most of the face
    # (not every pixel) inside the frame; faces outside stay rejected.
    ix = max(0.0, min(x2, gx2) - max(x1, gx1))
    iy = max(0.0, min(y2, gy2) - max(y1, gy1))
    return ix * iy >= INSIDE_RATIO * (x2 - x1) * (y2 - y1)


def completed_result(result):
    if result.get("result") in ("ok", "duplicate", "denied", "visitor"):
        return {**result, "next_delay_seconds": NEXT_PERSON_SECONDS}
    return result