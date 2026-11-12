"""Visible rectangular scan boundary and the fixed queue pause (no CV dependency)."""

NEXT_PERSON_SECONDS = 2
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
    return (left * width <= x1 < x2 <= right * width
            and top * height <= y1 < y2 <= bottom * height)


def completed_result(result):
    if result.get("result") in ("ok", "duplicate", "denied", "visitor"):
        return {**result, "next_delay_seconds": NEXT_PERSON_SECONDS}
    return result