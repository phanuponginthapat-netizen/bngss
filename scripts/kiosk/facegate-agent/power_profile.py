from __future__ import annotations

import os
import platform
import time
from collections import deque
from functools import lru_cache

MODES = ("eco", "balanced", "full")

# CPUs that cannot afford more than one detector pass per frame.
ECO_MARKERS = (
    "celeron", "atom", "pentium", "quark", "emount", "bay trail", "apollolake",
    "apollo lake", "gemini lake", "elkhart lake", "jinian", "tremont",
    "j1900", "j1800", "j1900", "j6412", "j5040", "n3050", "n3350", "n3160",
    "n2840", "n2930", "e3825", "e3845", "n100", "n95", "n97", "core 2 duo",
    "core2 duo", "amd e1", "amd e2", "amd a4", "a6-9220", "fx-6300",
)

# Detectors: one small SCRFD pass at 320x320 is what every profile starts from.
DET_SIZE = int(os.environ.get("FACEGATE_DET_SIZE", "320") or 320)

# How much extra work a frame may do when the cheap pass found nothing usable.
# "full" keeps the original behaviour (always try the harder passes); eco spends
# them only when there is a real sign of a face.
PROFILES: dict[str, dict[str, float]] = {
    "eco": {
        "light_pass_min": 0.15,   # try the lighting-corrected pass from here
        "big_pass_min": 0.20,     # try the bigger detector input from here
        "big_cooldown_s": 2.0,    # ...and at most once every so often
        "force_check_s": 1.2,     # never rest for longer than this
    },
    "balanced": {
        "light_pass_min": 0.12,
        "big_pass_min": 0.15,
        "big_cooldown_s": 0.0,
        "force_check_s": 1.0,
    },
    "full": {
        "light_pass_min": 0.0,
        "big_pass_min": 0.0,
        "big_cooldown_s": 0.0,
        "force_check_s": 0.8,
    },
}


def cpu_name() -> str:
    """Human CPU name, best effort across Windows / Linux / macOS."""
    name = ""
    try:
        with open("/proc/cpuinfo", encoding="utf-8", errors="ignore") as fh:
            for line in fh:
                if line.lower().startswith("model name"):
                    name = line.split(":", 1)[1].strip()
                    break
    except OSError:
        pass
    if not name and os.name == "nt":
        try:
            import winreg

            key = winreg.OpenKey(
                winreg.HKEY_LOCAL_MACHINE,
                r"HARDWARE\DESCRIPTION\System\CentralProcessor\0",
            )
            name = str(winreg.QueryValueEx(key, "ProcessorNameString")[0])
            winreg.CloseKey(key)
        except Exception:  # noqa: BLE001
            pass
    return (name or platform.processor() or "").lower()


def mode(override: str | None = None, name: str | None = None, cores: int | None = None) -> str:
    """eco / balanced / full — from FACEGATE_POWER_MODE, then the CPU itself."""
    wanted = (override if override is not None else os.environ.get("FACEGATE_POWER_MODE", "")).strip().lower()
    if wanted in MODES:
        return wanted
    if wanted in ("low", "battery", "save"):
        return "eco"
    if wanted in ("high", "max", "fast"):
        return "full"

    cpu = (name if name is not None else cpu_name()).lower()
    if any(marker in cpu for marker in ECO_MARKERS):
        return "eco"
    cores = int(cores if cores is not None else (os.cpu_count() or 4))
    if cores <= 2:
        return "eco"
    if cores <= 4:
        return "balanced"
    return "full"


def tuning(chosen: str | None = None) -> dict[str, float]:
    """The budget for one frame on this machine."""
    return PROFILES.get(chosen or mode(), PROFILES["balanced"])


class SceneGate:
    """Decides whether a frame is worth running the models on at all.

    A fixed difference threshold fails on the cheap USB cameras schools use:
    auto-exposure flicker keeps every frame "moving", so the scanner burns a
    full detection on an empty lobby. Instead the camera's own noise floor is
    learned, and only a jump clearly above it counts as somebody arriving. A
    full check is forced at least every `force_check_s` seconds so a person
    standing perfectly still is never waited out.
    """

    def __init__(self, min_thresh: float = 1.0, learn: float = 0.05, margin: float = 3.0,
                 floor: float = 0.25, force_check_s: float = 1.2) -> None:
        self.min_thresh = float(min_thresh)
        self.learn = float(learn)
        self.margin = float(margin)
        self.floor = float(floor)
        self.force_check_s = float(force_check_s)
        self.baseline = 0.0
        self.skips = 0
        self._checked_at = 0.0

    def threshold(self) -> float:
        return max(self.min_thresh, self.baseline * self.margin + self.floor)

    def is_static(self, diff: float, now: float | None = None) -> bool:
        now = time.time() if now is None else float(now)
        if diff >= self.threshold():
            # Somebody moved: run the models and do not teach the floor from it.
            self.skips = 0
            self._checked_at = now
            return False
        # Quiet frame: pull the noise floor towards what the camera really does.
        self.baseline += self.learn * (float(diff) - self.baseline)
        if now - self._checked_at >= self.force_check_s:
            self.skips = 0
            self._checked_at = now
            return False
        self.skips += 1
        return True


def pass_plan(chosen: str, top_score: float, lighting_off: bool, now: float,
              last_big: float) -> tuple[bool, bool]:
    """Which extra detector passes this frame may run.

    Returns (run_lighting_pass, run_bigger_detector_pass). `top_score` is the
    best detection score the cheap pass produced — even below the match
    threshold it is a real sign that a face is there, just small or badly lit.
    """
    budget = PROFILES.get(chosen, PROFILES["balanced"])
    light = bool(lighting_off) or top_score >= budget["light_pass_min"]
    big = top_score >= budget["big_pass_min"] and (now - last_big) >= budget["big_cooldown_s"]
    return light, big


class Timer:
    """Remembers how long the models really take, so the speed can be checked."""

    def __init__(self) -> None:
        self.scans = 0
        self.skipped = 0
        self.last_ms = 0.0
        self.avg_ms = 0.0
        self.max_ms = 0.0

    def note(self, ms: float) -> None:
        ms = max(0.0, float(ms))
        self.scans += 1
        self.last_ms = ms
        self.avg_ms = ms if self.avg_ms == 0.0 else self.avg_ms * 0.9 + ms * 0.1
        self.max_ms = max(self.max_ms, ms)

    def note_skipped(self) -> None:
        self.skipped += 1

    def status(self) -> dict[str, float | int | str]:
        return {
            "profile": mode(),
            "scans": self.scans,
            "skipped": self.skipped,
            "last_ms": round(self.last_ms, 1),
            "avg_ms": round(self.avg_ms, 1),
            "max_ms": round(self.max_ms, 1),
        }


def sleep_until(next_at: float) -> None:
    left = next_at - time.time()
    if left > 0:
        time.sleep(min(left, 0.5))


__all__ = ["MODES", "DET_SIZE", "PROFILES", "cpu_name", "mode", "tuning",
           "SceneGate", "pass_plan", "Timer", "sleep_until"]
