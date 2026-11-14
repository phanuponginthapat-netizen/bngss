"""
FaceGate local agent
--------------------
Runs on the kiosk PC (Intel Atom + webcam) next to the browser kiosk page.

Responsibilities
1. Sync students, settings and face embeddings from the cloud.
2. Compute ArcFace embeddings (InsightFace buffalo_l) for photos registered in
   the admin site, and upload them back.
3. Receive a webcam frame from the browser, match it against known embeddings,
   run a simple anti-spoof (liveness) check, and record attendance in the cloud.

Start with:  python agent.py
"""

import base64
import hashlib
import io
import zipfile
from datetime import datetime, timezone, timedelta
import json
import os
import platform
import threading
import time
from typing import Any
import sys

# Windows installer (FaceGateSetup.exe): settings live in a config file instead of a .bat launcher.
FROZEN = bool(getattr(sys, "frozen", False))


def _load_config_file() -> None:
    paths = []
    if FROZEN:
        paths.append(os.path.join(os.path.dirname(sys.executable), "facegate.env"))
    paths.append(os.path.join(os.environ.get("PROGRAMDATA", ""), "FaceGate", "facegate.env"))
    for path in paths:
        try:
            with open(path, encoding="utf-8-sig") as fh:
                for line in fh:
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    k, v = line.split("=", 1)
                    if k.strip() and v.strip():
                        os.environ.setdefault(k.strip(), v.strip())
        except OSError:
            continue


_load_config_file()

if FROZEN and sys.stdout is None:
    try:
        _log_dir = os.path.join(os.environ.get("LOCALAPPDATA") or os.path.expanduser("~"), "FaceGate")
        os.makedirs(_log_dir, exist_ok=True)
        sys.stdout = sys.stderr = open(os.path.join(_log_dir, "agent.log"), "a", encoding="utf-8", buffering=1)
    except OSError:
        pass

import cv2
import numpy as np
import requests
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import clock
import door
import power
import power_profile
from cloud_config import cloud_api_url
from power_schedule import plan as offline_power_plan, DailyShutdown
daily_shutdown = DailyShutdown()
from voice_prepare import VoicePreparation
voice_preparation = VoicePreparation()
import qr_reader
from school_scan_policy import evaluate_school_scan
from scan_guide import face_inside, completed_result, NEXT_PERSON_SECONDS
from face_engine import Face, FaceEngine
from pydantic import BaseModel

# Standalone build: everything (database, admin pages, kiosk screen) lives on
# this PC, so the "cloud" the agent talks to is its own local API.
#
# LAN mode adds a second role: one PC keeps the data (the hub, FACEGATE_STANDALONE=1)
# and extra kiosks run as satellites (FACEGATE_HUB_URL=http://<hub-ip>:8899) that
# scan with their own camera but read and write the hub's database.
STANDALONE = os.environ.get("FACEGATE_STANDALONE", "") in ("1", "true", "on", "yes")
PORT_ENV = int(os.environ.get("FACEGATE_PORT", "8899"))


def _hub_url() -> str:
    raw = os.environ.get("FACEGATE_HUB_URL", "").strip().rstrip("/")
    if not raw:
        return ""
    if not raw.startswith("http"):
        raw = f"http://{raw}"
    if not raw.endswith("/local"):
        raw = f"{raw}/local"
    return raw


HUB_URL = _hub_url()
SATELLITE = bool(HUB_URL)
if SATELLITE:
    STANDALONE = False
CLOUD_URL = (
    HUB_URL
    if SATELLITE
    else f"http://127.0.0.1:{PORT_ENV}/local"
    if STANDALONE
    else cloud_api_url(os.environ.get("FACEGATE_CLOUD_URL"))
)
DEVICE_KEY = os.environ.get("FACEGATE_DEVICE_KEY", "local") if STANDALONE else os.environ.get("FACEGATE_DEVICE_KEY", "")
SYNC_SECONDS = int(os.environ.get("FACEGATE_SYNC_SECONDS", "30"))
PORT = int(os.environ.get("FACEGATE_PORT", "8899"))
AGENT_VERSION = "1.13.0"


def default_cache_dir() -> str:
    base = os.environ.get("LOCALAPPDATA") or os.path.join(
        os.path.expanduser("~"), ".local", "share"
    )
    return os.path.join(base, "FaceGate", "cache")


CACHE_DIR = os.environ.get("FACEGATE_CACHE_DIR", default_cache_dir())
IMAGE_DIR = os.path.join(CACHE_DIR, "images")
FACES_FILE = os.path.join(CACHE_DIR, "faces.json")
STUDENTS_FILE = os.path.join(CACHE_DIR, "students.json")
SETTINGS_FILE = os.path.join(CACHE_DIR, "settings.json")
OUTBOX_FILE = os.path.join(CACHE_DIR, "outbox.jsonl")

os.makedirs(IMAGE_DIR, exist_ok=True)

HEADERS = {"x-device-key": DEVICE_KEY, "content-type": "application/json"}

app = FastAPI(title="FaceGate Agent")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

if STANDALONE:
    import local_api
    import local_ui
    from fastapi.responses import HTMLResponse, RedirectResponse

    app.include_router(local_api.router, prefix="/local")

    @app.get("/kiosk")
    def kiosk_screen():  # offline kiosk screen
        return HTMLResponse(local_ui.KIOSK_HTML)

    @app.get("/admin")
    def admin_screen():  # offline admin pages
        return HTMLResponse(local_ui.ADMIN_HTML)

    @app.get("/visit")
    def visit_screen():  # visitor self-registration (opened from the kiosk QR code)
        return HTMLResponse(local_ui.VISIT_HTML)

    @app.get("/")
    def home_screen():
        return RedirectResponse("/kiosk")


if SATELLITE:
    # A satellite kiosk has no database of its own: it shows the same offline
    # kiosk screen and forwards every data request to the hub PC on the LAN.
    import local_ui
    from fastapi import Request as _Request
    from fastapi.responses import HTMLResponse, RedirectResponse, Response as _Response

    @app.get("/kiosk")
    def kiosk_screen_satellite():
        return HTMLResponse(local_ui.KIOSK_HTML)

    @app.get("/visit")
    def visit_screen_satellite():
        return HTMLResponse(local_ui.VISIT_HTML)

    @app.get("/")
    def home_screen_satellite():
        return RedirectResponse("/kiosk")

    @app.api_route("/local/{path:path}", methods=["GET", "POST", "DELETE"])
    async def hub_proxy(path: str, request: _Request):
        from starlette.concurrency import run_in_threadpool

        body = await request.body() if request.method != "GET" else None

        def call():
            return requests.request(
                request.method,
                f"{HUB_URL}/{path}",
                headers={"x-device-key": DEVICE_KEY,
                         "content-type": request.headers.get("content-type", "application/json")},
                params=dict(request.query_params),
                data=body,
                timeout=30,
            )

        try:
            res = await run_in_threadpool(call)
        except Exception as exc:  # noqa: BLE001
            return _Response(
                content=json.dumps({"detail": f"ติดต่อเครื่องแม่ไม่ได้: {exc}"}, ensure_ascii=False),
                status_code=503,
                media_type="application/json",
            )
        return _Response(
            content=res.content,
            status_code=res.status_code,
            media_type=res.headers.get("content-type"),
        )


# ArcFace. The detector input stays small so an Intel Atom can keep up; how
# small, and how much extra work a frame may do, is chosen by power_profile
# from the CPU the program is actually running on.
# The models are loaded in the background so the kiosk page can connect to the
# program straight away instead of waiting for onnxruntime to warm up.
POWER_MODE = power_profile.mode()
TUNING = power_profile.tuning(POWER_MODE)
PERF = power_profile.Timer()
_engine: FaceEngine | None = None
_engine_lock = threading.Lock()


def get_engine() -> FaceEngine:
    global _engine
    with _engine_lock:
        if _engine is None:
            _engine = FaceEngine(det_size=(power_profile.DET_SIZE, power_profile.DET_SIZE))
        return _engine


class _LazyEngine:
    """Loads the real engine on first use."""

    def __getattr__(self, name: str) -> Any:
        return getattr(get_engine(), name)


face_app = _LazyEngine()

state: dict[str, Any] = {
    "faces": {},  # face_id -> {student_id, embedding, geometry, version}
    "matrix": np.zeros((0, 512), dtype=np.float32),  # normalised embeddings
    "owners": [],  # student_id per row
    "geoms": [],  # landmark geometry per row
    "students": {},
    "settings": {},
    "last_sync": None,
    "last_activity": time.time(),
    "power": {},
    "camera_ok": None,
}
lock = threading.Lock()
outbox_lock = threading.Lock()


# --- Local cache -----------------------------------------------------------
def write_json_atomic(path: str, payload: Any) -> None:
    tmp = f"{path}.tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(payload, fh)
    os.replace(tmp, path)


def read_json(path: str, fallback: Any) -> Any:
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:  # noqa: BLE001
        return fallback


def rebuild_matrix_locked() -> None:
    """Rebuild the search matrix from state['faces']. Caller holds the lock."""
    rows, owners, geoms = [], [], []
    for face in state["faces"].values():
        vec = np.array(face.get("embedding") or [], dtype=np.float32)
        if vec.size:
            rows.append(normalise(vec))
            owners.append(face["student_id"])
            geoms.append(face.get("geometry") or None)
    state["matrix"] = np.vstack(rows) if rows else np.zeros((0, 512), dtype=np.float32)
    state["owners"] = owners
    state["geoms"] = geoms


def save_cache() -> None:
    with lock:
        faces = dict(state["faces"])
        students = list(state["students"].values())
        settings = dict(state["settings"])
    try:
        write_json_atomic(FACES_FILE, faces)
        write_json_atomic(STUDENTS_FILE, students)
        write_json_atomic(SETTINGS_FILE, settings)
    except Exception as exc:  # noqa: BLE001
        print(f"[agent] cache write failed: {exc}")


def load_cache() -> None:
    faces = read_json(FACES_FILE, {}) or {}
    students = read_json(STUDENTS_FILE, []) or []
    settings = read_json(SETTINGS_FILE, {}) or {}
    with lock:
        state["faces"] = {k: v for k, v in faces.items() if isinstance(v, dict)}
        state["students"] = {s["id"]: s for s in students if isinstance(s, dict)}
        state["settings"] = settings
        rebuild_matrix_locked()
    print(f"[agent] loaded {len(faces)} cached faces from {CACHE_DIR}")


def prune_images(valid_ids: set[str]) -> None:
    try:
        for name in os.listdir(IMAGE_DIR):
            if os.path.splitext(name)[0] not in valid_ids:
                os.remove(os.path.join(IMAGE_DIR, name))
    except Exception:  # noqa: BLE001
        pass


def cache_image(face_id: str, data: bytes) -> None:
    try:
        tmp = os.path.join(IMAGE_DIR, f"{face_id}.tmp")
        with open(tmp, "wb") as fh:
            fh.write(data)
        os.replace(tmp, os.path.join(IMAGE_DIR, f"{face_id}.jpg"))
    except Exception:  # noqa: BLE001
        pass


def cached_image(face_id: str) -> bytes | None:
    path = os.path.join(IMAGE_DIR, f"{face_id}.jpg")
    try:
        with open(path, "rb") as fh:
            return fh.read()
    except Exception:  # noqa: BLE001
        return None


# --- Offline outbox --------------------------------------------------------
def outbox_count() -> int:
    with outbox_lock:
        try:
            with open(OUTBOX_FILE, encoding="utf-8") as fh:
                return sum(1 for line in fh if line.strip())
        except Exception:  # noqa: BLE001
            return 0


def outbox_append(payload: dict) -> None:
    with outbox_lock:
        try:
            with open(OUTBOX_FILE, "a", encoding="utf-8") as fh:
                fh.write(json.dumps(payload, ensure_ascii=False) + "\n")
        except Exception as exc:  # noqa: BLE001
            print(f"[agent] outbox write failed: {exc}")


# Fast queue: greet the student from local data at once and send the record in
# the background, so the line never waits on the internet (target < 3 s/person).
_recent_ok: dict[str, float] = {}


def _post_attendance_bg(payload: dict) -> None:
    for attempt in range(2):
        try:
            res = requests.post(f"{CLOUD_URL}/kiosk-api/attendance", headers=HEADERS, json=payload, timeout=15)
            res.raise_for_status()
            if res.json().get("result") not in ("ok", "duplicate"):
                raise RuntimeError("Cloud did not confirm attendance")
            _fails["count"] = 0
            return
        except Exception as exc:  # noqa: BLE001
            last = exc
            if attempt == 0:
                time.sleep(0.6)
    print(f"[agent] upload failed, queued offline: {last}")
    outbox_append(payload)


def submit_attendance_fast(payload: dict, settings: dict, delay: int, extra: dict | None = None) -> dict:
    """Answer the kiosk instantly; duplicates are caught locally within the cooldown."""
    sid = payload["student_id"]
    with lock:
        person = state["students"].get(sid) or {}
    name = person.get("full_name") or "ผู้ใช้งาน"
    if not person or person.get("is_active") is False:
        return {"result": "denied", "message": "ไม่พบผู้ใช้งานที่กำลังใช้งานในทะเบียน", "next_delay_seconds": 1}
    if person.get('person_type') == 'visitor':
        today = clock.now_tz(timezone(timedelta(hours=7))).date().isoformat()
        if person.get('valid_until') != today:
            return {'result':'denied','message':'ทะเบียนผู้มาติดต่อหมดอายุ','next_delay_seconds':2}
        threading.Thread(target=_post_attendance_bg, args=(payload,), daemon=True).start()
        return {**(extra or {}), 'result': 'ok', 'student_id': sid, 'name': name, 'student': person,
                'avatar_url': person.get('avatar_url'), 'message': f'ผู้มาติดต่อ {name} กรุณาแจ้งเจ้าหน้าที่',
                'speak': f'บันทึกผู้มาติดต่อแล้ว {name}', 'next_delay_seconds': 2}
    try:
        rule = evaluate_school_scan(settings, payload.get("direction") or settings.get("device_default_direction"), clock.now_tz(timezone.utc))
    except ValueError:
        return {"result": "denied", "message": "ค่าช่วงเวลาสแกนไม่ถูกต้อง กรุณาซิงก์การตั้งค่าใหม่", "next_delay_seconds": 1}
    if not rule["allowed"]:
        return {"result": "denied", "message": rule["reason"], "speak": rule["reason"], "next_delay_seconds": 1}
    payload["direction"] = rule["direction"]
    duplicate_key = f"{sid}:{rule['direction']}"
    is_staff = person.get("person_type") == "staff"
    cooldown_s = float(settings.get("duplicate_cooldown_minutes") or 0) * 60
    now = time.time()
    last = _recent_ok.get(duplicate_key)
    if not is_staff and last is not None and cooldown_s > 0 and now - last < cooldown_s:
        return {**(extra or {}), "result": "duplicate", "student_id": sid, "name": name,
                "message": f"{name} บันทึกเวลาไปแล้ววันนี้",
                "speak": f'{settings.get("voice_duplicate_text") or "บันทึกไปแล้ว"} {name}',
                "next_delay_seconds": 1}
    _recent_ok[duplicate_key] = now
    threading.Thread(target=_post_attendance_bg, args=(payload,), daemon=True).start()
    out = payload.get("direction") == "out"
    welcome = settings.get("voice_welcome_text") or "ยินดีต้อนรับ"
    return door_react({**(extra or {}), "result": "ok", "student_id": sid, "name": name, "student": person, "avatar_url": person.get("avatar_url"), "direction": rule["direction"],
                       "message": f"{name} บันทึกเวลาออกแล้ว" if out else f"{name} บันทึกเวลาเข้าเรียบร้อย",
                       "speak": f"เดินทางปลอดภัย {name}" if out else f"{welcome} {name}",
                       "next_delay_seconds": delay})




def outbox_flush() -> None:
    with outbox_lock:
        try:
            with open(OUTBOX_FILE, encoding="utf-8") as fh:
                lines = [line for line in fh if line.strip()]
        except Exception:  # noqa: BLE001
            return
        if not lines:
            return
        remaining: list[str] = []
        for line in lines:
            try:
                response = requests.post(
                    f"{CLOUD_URL}/kiosk-api/attendance",
                    headers=HEADERS,
                    data=line.encode("utf-8"),
                    timeout=20,
                )
                response.raise_for_status()
                if response.json().get("result") not in ("ok", "duplicate"):
                    raise RuntimeError("Cloud did not confirm queued attendance")
            except Exception:  # noqa: BLE001
                remaining.append(line)
        try:
            if remaining:
                with open(f"{OUTBOX_FILE}.tmp", "w", encoding="utf-8") as fh:
                    fh.writelines(remaining)
                os.replace(f"{OUTBOX_FILE}.tmp", OUTBOX_FILE)
            else:
                os.remove(OUTBOX_FILE)
        except Exception:  # noqa: BLE001
            pass


def outbox_loop() -> None:
    while True:
        try:
            outbox_flush()
        except Exception:  # noqa: BLE001
            pass
        time.sleep(30)



def normalise(vec: np.ndarray) -> np.ndarray:
    norm = np.linalg.norm(vec)
    return vec / norm if norm else vec


# --- Facial geometry -------------------------------------------------------
# ArcFace gives 5 landmarks: left eye, right eye, nose, left mouth, right mouth.
# We turn them into scale-invariant ratios (every distance divided by the
# eye-to-eye distance), which describe the individual layout of the face:
# how far the nose sits from each eye, mouth width, nose-to-mouth distance and
# so on. This is used as a second opinion on top of the ArcFace embedding.
GEOMETRY_KEYS = [
    "nose_left_eye",
    "nose_right_eye",
    "nose_eye_mid",
    "mouth_width",
    "nose_mouth_mid",
    "eye_mid_mouth_mid",
    "left_eye_mouth_left",
    "right_eye_mouth_right",
    "face_width",
    "face_height",
    "eye_asymmetry",
]


def geometry_features(face) -> dict[str, float] | None:
    kps = getattr(face, "kps", None)
    if kps is None or len(kps) < 5:
        return None
    pts = np.array(kps, dtype=np.float32)
    left_eye, right_eye, nose, mouth_l, mouth_r = pts[0], pts[1], pts[2], pts[3], pts[4]
    eye_dist = float(np.linalg.norm(right_eye - left_eye))
    if eye_dist < 1e-3:
        return None

    eye_mid = (left_eye + right_eye) / 2.0
    mouth_mid = (mouth_l + mouth_r) / 2.0
    x1, y1, x2, y2 = [float(v) for v in face.bbox]

    d = lambda a, b: float(np.linalg.norm(a - b)) / eye_dist  # noqa: E731
    nose_l = d(nose, left_eye)
    nose_r = d(nose, right_eye)

    feats = {
        "nose_left_eye": nose_l,
        "nose_right_eye": nose_r,
        "nose_eye_mid": d(nose, eye_mid),
        "mouth_width": d(mouth_l, mouth_r),
        "nose_mouth_mid": d(nose, mouth_mid),
        "eye_mid_mouth_mid": d(eye_mid, mouth_mid),
        "left_eye_mouth_left": d(left_eye, mouth_l),
        "right_eye_mouth_right": d(right_eye, mouth_r),
        "face_width": (x2 - x1) / eye_dist,
        "face_height": (y2 - y1) / eye_dist,
        "eye_asymmetry": abs(nose_l - nose_r) / max(nose_l + nose_r, 1e-3),
    }
    return {k: round(float(v), 5) for k, v in feats.items()}


def geometry_similarity(a: dict | None, b: dict | None) -> float | None:
    """1.0 = identical proportions. Relative difference, averaged."""
    if not a or not b:
        return None
    diffs = []
    for key in GEOMETRY_KEYS:
        av, bv = a.get(key), b.get(key)
        if av is None or bv is None:
            continue
        denom = abs(av) + abs(bv)
        if denom < 1e-6:
            continue
        diffs.append(abs(av - bv) / denom)
    if not diffs:
        return None
    return float(max(0.0, 1.0 - 2.0 * (sum(diffs) / len(diffs))))


# Size of the on-screen oval guide, as a share of the camera picture.
# Faces outside this oval belong to people walking past, not to the person
# being scanned, so they are ignored.
GUIDE_RX = 0.38
GUIDE_RY = 0.44
# Anyone whose face reaches within this much of the oval counts as crowding it.
GUIDE_MARGIN = 1.25


def inside_guide_margin(dets, i: int, cx: float, cy: float, rx: float, ry: float) -> bool:
    fx = (float(dets[i, 0]) + float(dets[i, 2])) / 2.0
    fy = (float(dets[i, 1]) + float(dets[i, 3])) / 2.0
    return ((fx - cx) / (rx * GUIDE_MARGIN)) ** 2 + ((fy - cy) / (ry * GUIDE_MARGIN)) ** 2 <= 1.0



def embed_image(bgr: np.ndarray):
    faces = face_app.get(bgr)
    if not faces:
        return None
    # Largest face wins (the person standing at the kiosk).
    face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
    return face


def laplacian_sharpness(bgr: np.ndarray) -> float:
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def looks_like_a_real_person(bgr: np.ndarray, face) -> bool:
    """Cheap anti-spoof: printed photos / phone screens are flat and blurry."""
    x1, y1, x2, y2 = [int(v) for v in face.bbox]
    crop = bgr[max(y1, 0):y2, max(x1, 0):x2]
    if crop.size == 0:
        return False
    sharpness = laplacian_sharpness(crop)
    colour_spread = float(np.std(crop.reshape(-1, 3), axis=0).mean())
    return sharpness > 45 and colour_spread > 18


def crop_face_jpeg(bgr: np.ndarray, face, margin: float = 0.35) -> str | None:
    """JPEG (base64) of the scanned face, kept as evidence in the cloud."""
    x1, y1, x2, y2 = [int(v) for v in face.bbox]
    w, h = x2 - x1, y2 - y1
    mx, my = int(w * margin), int(h * margin)
    crop = bgr[max(y1 - my, 0): y2 + my, max(x1 - mx, 0): x2 + mx]
    if crop.size == 0:
        return None
    if crop.shape[0] > 480:
        scale = 480 / crop.shape[0]
        crop = cv2.resize(crop, (int(crop.shape[1] * scale), 480))
    ok, buf = cv2.imencode(".jpg", crop, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
    return base64.b64encode(buf).decode() if ok else None


def device_health() -> dict:
    """Free disk space, camera and door status, reported on every sync so the
    school sees a problem on the health page before it stops the kiosk."""
    info: dict[str, Any] = {}
    try:
        import shutil

        usage = shutil.disk_usage(os.path.dirname(os.path.abspath(__file__)))
        info["disk_free_mb"] = int(usage.free / (1024 * 1024))
    except Exception:
        pass
    cam = state.get("camera_ok")
    if isinstance(cam, bool):
        info["camera_ok"] = cam
    try:
        door_state = door.status()
        info["door_ok"] = bool(door_state.get("connected")) if door_state.get("enabled") else True
    except Exception:
        info["door_ok"] = False
    notes = []
    if info.get("disk_free_mb") is not None and info["disk_free_mb"] < 1024:
        notes.append("พื้นที่ดิสก์เหลือน้อย")
    if info.get("camera_ok") is False:
        notes.append("กล้องไม่ตอบสนอง")
    if info.get("door_ok") is False:
        notes.append("ไม่พบ micro:bit ประตู")
    info["voice_progress"] = voice_preparation.status()
    info["health_note"] = " • ".join(notes)
    return info


def sync_once() -> None:
    with lock:
        known = {fid: f.get("version") or "" for fid, f in state["faces"].items()}

    res = requests.post(
        f"{CLOUD_URL}/kiosk-api/sync",
        headers=HEADERS,
        json={
            "known": known,
            "agent_version": AGENT_VERSION,
            "platform": f"{platform.system()} {platform.release()}".strip(),
            **device_health(),
        },
        timeout=30,
    )
    res.raise_for_status()
    data = res.json()

    incremental = bool(data.get("incremental"))
    changed = data.get("embeddings", []) or []
    removed = data.get("removed", []) or []

    with lock:
        faces = dict(state["faces"]) if incremental else {}
        for item in changed:
            if not item.get("embedding"):
                continue
            faces[item["id"]] = {
                "student_id": item["student_id"],
                "embedding": item["embedding"],
                "geometry": item.get("geometry") or None,
                "version": item.get("version") or "",
            }
        for face_id in removed:
            faces.pop(face_id, None)
        state["faces"] = faces
        state["students"] = {s["id"]: {**s, "valid_until": datetime.now(timezone.utc).astimezone(timezone(timedelta(hours=7))).date().isoformat() if s.get("person_type")=="visitor" else None} for s in data.get("students", [])}
        state["settings"] = data.get("settings") or {}
        default_direction = (data.get("device") or {}).get("default_direction")
        state["settings"]["device_default_direction"] = default_direction if default_direction in ("in", "out") else None
        state["last_sync"] = time.time()
        door_cfg = door_config_from_settings(state["settings"])
        rebuild_matrix_locked()
        valid_ids = set(faces.keys())

    save_cache()
    prune_images(valid_ids)
    try:
        door.configure(door_cfg)
    except Exception as exc:  # noqa: BLE001
        print(f"[door] config push failed: {exc}")
    if changed or removed:
        print(f"[agent] sync: +{len(changed)} / -{len(removed)} faces (total {len(valid_ids)})")

    pending = data.get("pending", [])
    if pending:
        process_pending(pending)


def process_pending(pending: list[dict]) -> None:
    """Compute embeddings for newly registered photos and send them back.

    Photos are kept on disk so the embeddings can be recomputed later without
    downloading them again.
    """
    results = []
    for item in pending:
        try:
            img_bytes = cached_image(item["id"])
            if img_bytes is None:
                if str(item['url']).startswith('data:image/'):
                    img_bytes = base64.b64decode(str(item['url']).split(',', 1)[1], validate=True)
                else:
                    response = requests.get(item['url'], timeout=30)
                    response.raise_for_status()
                    img_bytes = response.content
                cache_image(item["id"], img_bytes)
            if str(item['url']).startswith('data:image/'):
                img_bytes = base64.b64decode(str(item['url']).split(',', 1)[1], validate=True)
                cache_image(item['id'], img_bytes)
            arr = cv2.imdecode(np.frombuffer(img_bytes, np.uint8), cv2.IMREAD_COLOR)
            face = embed_image(arr) if arr is not None else None
            if face is None:
                results.append({"face_id": item["id"], "error": "ไม่พบใบหน้าในรูปนี้"})
                continue
            results.append(
                {
                    "face_id": item["id"],
                    "embedding": normalise(face.normed_embedding).tolist(),
                    "geometry": geometry_features(face),
                    "quality": float(getattr(face, "det_score", 0.0)),
                }
            )
        except Exception as exc:  # noqa: BLE001
            results.append({"face_id": item["id"], "error": str(exc)[:200]})

    response = requests.post(
        f"{CLOUD_URL}/kiosk-api/embeddings",
        headers=HEADERS,
        json={"results": results},
        timeout=60,
    )

    response.raise_for_status()
    if response.json().get('saved', 0) != sum(1 for item in results if item.get('embedding')):
        raise RuntimeError('Cloud did not confirm all prepared faces')

    # Make the new faces usable straight away instead of waiting for the next
    # sync round trip: a visitor who just registered can scan immediately.
    owners = {item["id"]: item.get("student_id") for item in pending}
    applied = 0
    with lock:
        for res in results:
            if res.get("error") or not res.get("embedding"):
                continue
            student_id = owners.get(res["face_id"])
            if not student_id:
                continue
            state["faces"][res["face_id"]] = {
                "student_id": student_id,
                "embedding": res["embedding"],
                "geometry": res.get("geometry"),
                "version": datetime.now(timezone.utc).isoformat(),
            }
            applied += 1
        if applied:
            rebuild_matrix_locked()
    if applied:
        save_cache()
    print(f"[agent] processed {len(results)} registration photos (+{applied} ready now)")



# --- Remote control, stranger alerts, visitors and self-update ----------------

_fails = {"count": 0, "last": 0.0, "reported": False, "escalated": False}


def note_failed_scan(snapshot: str | None) -> dict:
    """Capture once, report once, then escalate once on the fifth attempt."""
    now = time.time()
    if now - _fails["last"] > 120:
        _fails["count"] = 0
        _fails["reported"] = False
        _fails["escalated"] = False
    _fails["last"] = now
    _fails["count"] += 1
    with lock:
        threshold = max(5, int(state["settings"].get("failed_alert_threshold") or 5))
    first_report = not _fails["reported"]
    escalation = _fails["count"] >= threshold and not _fails["escalated"]
    if not first_report and not escalation:
        return {"attempts": _fails["count"], "escalated": _fails["escalated"]}
    message = (
        "บุคคลไม่ทราบชื่อกำลังพยายามบุกรุกโรงเรียน กรุณาดำเนินมาตรการรักษาความปลอดภัย"
        if escalation
        else "พบบุคคลที่ไม่ใช่บุคลากรหรือนักเรียนของโรงเรียน กรุณาตรวจสอบ"
    )
    try:
        response = requests.post(
            f"{CLOUD_URL}/kiosk-api/alert",
            headers=HEADERS,
            json={
                "attempts": _fails["count"],
                "snapshot": snapshot if first_report else None,
                "kind": "intrusion_attempt" if escalation else "unknown_person",
                "message": message,
                "detail": message,
            },
            timeout=10,
        )
        response.raise_for_status()
        if first_report:
            _fails["reported"] = True
        if escalation:
            _fails["escalated"] = True
    except Exception as exc:  # noqa: BLE001
        print(f"[agent] alert failed: {exc}")
    return {"attempts": _fails["count"], "escalated": escalation or _fails["escalated"]}


def log_visitor(snapshot: str | None, direction: str | None) -> dict | None:
    """Event mode: record guests instead of turning them away silently."""
    try:
        res = requests.post(
            f"{CLOUD_URL}/kiosk-api/visitor",
            headers=HEADERS,
            json={"snapshot": snapshot, "direction": direction or "in"},
            timeout=15,
        )
        data = res.json()
        res.raise_for_status()
        return data if data.get("visitor") else None
    except Exception as exc:  # noqa: BLE001
        print(f"[agent] visitor log failed: {exc}")
        return None


def report_command(data: dict, ok: bool, scheduled: bool = False) -> None:
    command_id = data.get('command_id')
    if not command_id:
        return
    response = requests.post(f'{CLOUD_URL}/kiosk-api/command-result', headers=HEADERS,
        json={'id': command_id, 'status': 'scheduled' if ok and scheduled else 'completed' if ok else 'failed',
              'detail': str(power.status().get('last_error') or '') if not ok else ''}, timeout=10)
    response.raise_for_status()


def command_once() -> None:
    res = requests.post(
        f"{CLOUD_URL}/kiosk-api/door-command", headers=HEADERS, json={}, timeout=15
    )
    res.raise_for_status()
    data = res.json()

    free_open = bool(data.get("free_open"))
    state["free_open"] = free_open
    if free_open and data.get("door_enabled", True):
        # Keep the barrier up during assembly time; refreshed every loop.
        door.open_door(90)

    command = data.get("command")
    if command == "open":
        door.open_door(float(data.get("seconds") or 5))
        print("[agent] remote open")
    elif command == "free":
        state["free_open"] = True
        door.open_door(float(data.get("seconds") or 300))
        print("[agent] remote free-open")
    elif command == "lock":
        state["free_open"] = False
        door.deny()
        print("[agent] remote lock")
    if command:
        report_command(data, bool(door.status().get("connected")))


def power_once() -> None:
    """Ask the cloud for remote power buttons and enforce the daily schedule."""
    res = requests.post(
        f"{CLOUD_URL}/kiosk-api/power-command",
        headers=HEADERS,
        json={},
        timeout=20,
    )
    res.raise_for_status()
    data = res.json() or {}
    with lock:
        state["power"] = data
        last_activity = float(state.get("last_activity") or time.time())

    command = data.get("command")
    if command == "wake":
        # Any online FaceGate machine on the same LAN can wake a sleeping kiosk.
        print("[power] remote command: wake")
        ok = power.wake_lan(
            str(data.get("wake_mac") or ""),
            str(data.get("wake_broadcast") or "255.255.255.255"),
            int(data.get("wake_port") or 9),
        )
        report_command(data, ok)
    elif command == 'live_view':
        _live["fast_until"] = time.time() + 300
        report_command(data, True)
    elif command == 'prepare_voice':
        import local_voice
        with lock:
            people, settings = list(state['students'].values()), dict(state['settings'])
        ok = voice_preparation.start(people, settings, local_voice.synthesize)
        report_command(data, ok, scheduled=True)
    elif command == 'test_voice':
        import local_voice
        clip = local_voice.synthesize('ทดสอบเสียง สแกนสำเร็จ ยินดีต้อนรับ')
        if clip:
            state['voice_test_at'] = time.time()
        report_command(data, bool(clip))
    elif command:
        print(f"[power] remote command: {command}")
        ok = power.apply(str(command), 60)
        report_command(data, ok, scheduled=command in ('shutdown', 'sleep'))

    enforce_power_plan(data)
    power.tick()


def enforce_power_plan(data):
    with lock:
        last_activity = float(state.get('last_activity') or time.time())
        settings = dict(state.get('settings') or {})
    if data.get("power_saving_enabled"):
        idle_minutes = float(data.get("screen_idle_minutes") or 0)
        idle = idle_minutes > 0 and (time.time() - last_activity) > idle_minutes * 60
        should_be_off = (bool(data.get("screen_off_window")) or idle) and not power.presence_active()
        status = power.status()
        currently_off = bool(status.get("screen_off"))
        if should_be_off and not currently_off:
            power.screen_off(manual=False)
        elif not should_be_off and currently_off and not status.get("manual_screen_off"):
            power.screen_on()

        if data.get("power_off_due") and not power.pending() and daily_shutdown.reserve(clock.now_tz(timezone(timedelta(hours=7))), settings):
            action = str(data.get("power_off_action") or "shutdown")
            print(f"[power] scheduled {action} in 60s")
            power.schedule(action, 60)

def power_loop() -> None:
    while True:
        try:
            power_once()
        except Exception as exc:  # noqa: BLE001
            print(f"[agent] power poll failed: {exc}")
            with lock:
                settings = dict(state.get('settings') or {})
            enforce_power_plan(offline_power_plan(settings, clock.now_tz(timezone(timedelta(hours=7)))))
        try:
            power.tick()
        except Exception:  # noqa: BLE001
            pass
        time.sleep(5)


class PowerRequest(BaseModel):
    command: str
    seconds: int | None = None


@app.get("/power/status")
def power_status():
    with lock:
        cloud = dict(state.get("power") or {})
    return {"ok": True, "cloud": cloud, **power.status()}


@app.post("/power/command")
def power_command(req: PowerRequest):
    """Run a power action locally (used by the kiosk screen and the test page)."""
    if req.command in ("screen_on", "cancel"):
        with lock:
            state["last_activity"] = time.time()
    if req.command not in ("screen_on", "cancel"):
        return {"ok": False, "error": "use authenticated school administration"}
    ok = power.apply(req.command, int(req.seconds or 60))
    return {"ok": ok, **power.status()}


def command_loop() -> None:
    while True:
        try:
            command_once()
        except Exception as exc:  # noqa: BLE001
            print(f"[agent] door command poll failed: {exc}")
        time.sleep(6)


# โปรแกรมรุ ่ นใหม ่ถู กแพ็กลงพ ื้ นท ี่เก ็บของโรงเร ียนทุกคร ั้ งท ี่เข ียนโปรแกรมเล ียน (GitHub Actions
# ห ัวข ้อ "Build FaceGate Agent") — หน ้าต ่ ากันน ี้เพ ื่ อให ้เคร ื่ องต ู้สแกนอัปเดตรุ ่ นใหม ่เอง
def _storage_object_base() -> str:
    origin = CLOUD_URL.split("/functions/")[0] if "/functions/" in CLOUD_URL else CLOUD_URL
    return origin.rstrip("/") + "/storage/v1/object"


UPDATE_MANIFEST_URL = os.environ.get(
    "FACEGATE_UPDATE_URL",
    f"{_storage_object_base()}/public/app-downloads/facegate-version.json",
)
UPDATE_MARKER = os.path.join(CACHE_DIR, "update.sha256")
UPDATE_KEEP = (".py", ".txt", ".md", ".sh", ".bat", ".ps1")


def self_update_once() -> bool:
    """Pull newer program files from the school's packaged installer (zip + checksum)."""
    if FROZEN:
        return False  # the .exe build is updated by running the new FaceGateSetup.exe
    with lock:
        if not state["settings"].get("auto_update_enabled", True):
            return False
    res = requests.get(UPDATE_MANIFEST_URL, timeout=20)
    res.raise_for_status()
    manifest = res.json()
    url = str(manifest.get("url") or "").strip()
    sha = str(manifest.get("sha256") or "").strip().lower()
    if not url.startswith("http") or len(sha) != 64:
        return False
    try:
        with open(UPDATE_MARKER, encoding="utf-8") as fh:
            if fh.read().strip().lower() == sha:
                return False  # this build is already installed here
    except OSError:
        pass

    body = requests.get(url, timeout=120).content
    if hashlib.sha256(body).hexdigest() != sha:
        raise RuntimeError("update checksum mismatch")

    here = os.path.dirname(os.path.abspath(__file__))
    changed = 0
    with zipfile.ZipFile(io.BytesIO(body)) as zf:
        for info in zf.infolist():
            name = info.filename.replace("\\", "/")
            if name.endswith("/") or name.count("/") != 1:
                continue  # facegate-agent/agent.py -> agent.py
            base = name.split("/", 1)[1]
            if base.startswith((".", "__")) or not base.endswith(UPDATE_KEEP):
                continue
            data = zf.read(info)
            target = os.path.join(here, base)
            try:
                with open(target, "rb") as fh:
                    if hashlib.sha256(fh.read()).hexdigest() == hashlib.sha256(data).hexdigest():
                        continue
            except OSError:
                pass
            with open(target, "wb") as fh:
                fh.write(data)
            changed += 1
            print(f"[agent] updated {base}")
    if changed:
        with open(UPDATE_MARKER, "w", encoding="utf-8") as fh:
            fh.write(sha)
    return changed > 0


def update_loop() -> None:
    while True:
        time.sleep(3600)
        if STANDALONE:
            continue
        try:
            if self_update_once():
                print("[agent] มีเวอร์ชันใหม่ กรุณาปิดและเปิดโปรแกรมอีกครั้ง")
                state["update_ready"] = True
        except Exception as exc:  # noqa: BLE001
            print(f"[agent] update check failed: {exc}")


def second_camera_loop() -> None:
    """Optional exit camera: scans on its own and records the set direction."""
    cap = None
    index = -1
    while True:
        with lock:
            wanted = int(state["settings"].get("second_camera_index", -1) or -1)
            direction = str(state["settings"].get("second_camera_direction") or "out")
        if wanted < 0:
            if cap is not None:
                cap.release()
                cap, index = None, -1
            time.sleep(5)
            continue
        if cap is None or index != wanted:
            if cap is not None:
                cap.release()
            cap = cv2.VideoCapture(wanted)
            index = wanted
            print(f"[agent] second camera #{wanted} -> {direction}")
        ok, frame = cap.read()
        if not ok or frame is None:
            time.sleep(2)
            continue
        try:
            ok_jpg, buf = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
            if ok_jpg:
                result = run_scan(base64.b64encode(buf).decode(), None if direction == "auto" else direction)
                if result.get("result") == "ok":
                    time.sleep(float(result.get("next_delay_seconds") or 5))
        except Exception as exc:  # noqa: BLE001
            print(f"[agent] second camera scan failed: {exc}")
        time.sleep(0.8)


def sync_loop() -> None:
    while True:
        try:
            sync_once()
        except Exception as exc:  # noqa: BLE001
            print(f"[agent] sync failed: {exc}")
        time.sleep(SYNC_SECONDS)


class ScanRequest(BaseModel):
    image: str


_live = {"at": 0.0, "fast_until": 0.0, "busy": False}


def push_live_frame(image: str) -> None:
    """Send a small preview picture so staff can watch the queue remotely."""
    if SATELLITE or STANDALONE:
        return
    with lock:
        if not state["settings"].get("live_view_enabled", True):
            return
        status = str(state.get("last_status") or "")
    now = time.time()
    fast = now < float(_live.get("fast_until") or 0)
    if now - _live["at"] < (0.4 if fast else 2.0) or _live.get("busy"):
        return
    _live["at"] = now
    _live["busy"] = True

    def send() -> None:
        try:
            small = image
            arr = cv2.imdecode(np.frombuffer(base64.b64decode(
                image.split(",")[-1]), np.uint8), cv2.IMREAD_COLOR)
            if arr is not None:
                height = max(1, int(320 * arr.shape[0] / arr.shape[1]))
                ok, buf = cv2.imencode(".jpg", cv2.resize(arr, (320, height)),
                                       [int(cv2.IMWRITE_JPEG_QUALITY), 55])
                if ok:
                    small = "data:image/jpeg;base64," + base64.b64encode(buf).decode()
            if not small.startswith("data:"):
                small = "data:image/jpeg;base64," + small
            requests.post(f"{CLOUD_URL}/kiosk-api/live", headers=HEADERS,
                          json={"image": small, "status": status}, timeout=10)
        except Exception as exc:  # noqa: BLE001
            print(f"[agent] live frame failed: {exc}")
        finally:
            _live["busy"] = False

    threading.Thread(target=send, daemon=True).start()


def detection_payload(dets: np.ndarray, kpss: np.ndarray, index: int, width: float, height: float):
    """Small visual payload for the kiosk overlay; recognition stays local."""
    x1, y1, x2, y2 = [float(value) for value in dets[index, :4]]
    return {
        "box": {"x": x1, "y": y1, "width": x2 - x1, "height": y2 - y1},
        "landmarks": [{"x": float(point[0]), "y": float(point[1])} for point in kpss[index]],
        "frame": {"width": width, "height": height},
        "score": round(float(dets[index, 4]), 4),
    }


def door_react(body: dict) -> dict:
    """Drive the micro:bit door lock from the decision made in the cloud."""
    with lock:
        settings = dict(state["settings"])
    if not settings.get("door_enabled", True):
        return body
    if state.get("free_open"):
        body["door"] = "free"
        return body
    seconds = float(settings.get("door_open_seconds") or 0) or None
    result = body.get("result")
    try:
        if result == "ok":
            body["door"] = "opened" if door.open_door(seconds) else "offline"
        elif result in ("denied", "duplicate", "out_of_window", "multiple_faces"):
            if settings.get("door_deny_alarm", True):
                door.deny()
            body["door"] = "locked"
    except Exception as exc:  # noqa: BLE001
        print(f"[door] control failed: {exc}")
    return body


def door_config_from_settings(settings: dict) -> dict:
    """Turn the cloud door settings into the micro:bit servo config."""
    return {
        "down": settings.get("door_angle_down", 10),
        "up": settings.get("door_angle_up", 100),
        "step": settings.get("door_move_step", 3),
        "delay": settings.get("door_move_delay_ms", 12),
        "hold": 1 if settings.get("door_hold_power", True) else 0,
        "buzzer": 1 if settings.get("door_buzzer_enabled", False) else 0,
        "relay": 1 if settings.get("door_use_relay", False) else 0,
        "manual": settings.get("door_open_seconds", 5),
        "invert": 1 if settings.get("door_invert_servo", False) else 0,
    }


class DoorRequest(BaseModel):
    seconds: float | None = None


@app.get("/door/status")
def door_status():
    return door.status()


@app.post("/door/test")
def door_test(req: DoorRequest):
    ok = door.open_door(req.seconds)
    return {"ok": ok, **door.status()}


@app.post("/door/close")
def door_close():
    ok = door.close_door()
    return {"ok": ok, **door.status()}


@app.post("/door/config")
def door_config():
    """Re-send the servo settings from the cloud to the micro:bit."""
    with lock:
        settings = dict(state["settings"])
    ok = door.configure(door_config_from_settings(settings))
    return {"ok": ok, **door.status()}


@app.get("/health")
def health():
    with lock:
        known_faces = int(state["matrix"].shape[0])
        students = len(state["students"])
        last_sync = state["last_sync"]
    try:
        cached_images = len(os.listdir(IMAGE_DIR))
    except Exception:  # noqa: BLE001
        cached_images = 0
    stale = last_sync is None or (time.time() - float(last_sync)) > SYNC_SECONDS * 3
    return {
        "ok": True,
        # --- web-compat fields (หน้าเว็บ /face-kiosk ใช้ตรวจว่ามี agent) ---
        "engine": "scrfd_500m+w600k_mbf",
        "version": AGENT_VERSION,
        "geometry": True,
        "dim": 512,
        "detSize": 320,
        "known_faces": known_faces,
        "students": students,
        "last_sync": last_sync,
        "stale": stale,
        "cached_images": cached_images,
        "pending_uploads": outbox_count(),
        "cache_dir": CACHE_DIR,
        "engine_ready": _engine is not None,
        "presence_active": power.presence_active(),
        "door": door.status(),
        "power": power.status(),
        "perf": PERF.status(),
    }





_motion: dict[str, Any] = {"prev": None, "visual": None}
_scene_gate = power_profile.SceneGate(force_check_s=TUNING["force_check_s"])

_clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))


def scene_is_static(bgr: np.ndarray) -> bool:
    """True when the frame looks the same as the previous one (nobody there).

    Detection + recognition are by far the heaviest part on a low-power CPU, so
    an unchanged frame is skipped before any model runs. The cut-off comes from
    the camera's own noise floor instead of one fixed number: the cheap USB
    cameras schools use flicker with auto-exposure, and a fixed cut-off makes
    the scanner read every one of those frames as somebody arriving. A full
    detection is still forced about once a second, so a person standing
    perfectly still is never missed.
    """
    small = cv2.resize(cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY), (64, 48))
    prev = _motion.get("prev")
    _motion["prev"] = small
    if prev is None:
        return False
    diff = float(np.mean(cv2.absdiff(prev, small)))
    static = _scene_gate.is_static(diff)
    if static:
        PERF.note_skipped()
    return static


def normalize_lighting(bgr: np.ndarray) -> np.ndarray:
    """Even out day/night, backlit and shadowed frames before detection.

    Auto gamma pulls very dark or very bright frames back to a mid exposure and
    CLAHE lifts local contrast (faces against a bright window, half-shadowed
    faces, warm evening light), which is what the detector actually needs.
    """
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    light, a_ch, b_ch = cv2.split(lab)
    mean = float(np.mean(light))
    if mean < 5.0:
        mean = 5.0
    # target a mid-grey exposure of ~128
    gamma = float(np.clip(np.log(128.0 / 255.0) / np.log(mean / 255.0), 0.45, 2.2))
    if abs(gamma - 1.0) > 0.08:
        table = np.array(
            [((i / 255.0) ** (1.0 / gamma)) * 255 for i in range(256)], dtype=np.uint8
        )
        light = cv2.LUT(light, table)
    light = _clahe.apply(light)
    return cv2.cvtColor(cv2.merge((light, a_ch, b_ch)), cv2.COLOR_LAB2BGR)


_big_pass_at = 0.0


def lighting_off(bgr: np.ndarray) -> bool:
    """True when the frame is too dark, too bright or too flat to trust as is."""
    lab = cv2.cvtColor(cv2.resize(bgr, (80, 60)), cv2.COLOR_BGR2LAB)
    light = lab[..., 0].astype(np.float32)
    mean = float(light.mean())
    spread = float(light.std())
    return mean < 70.0 or mean > 190.0 or spread < 28.0


def detect_adaptive(bgr: np.ndarray, det_min: float) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Detect faces, retrying with light correction and a larger input.

    Pass 1 is the cheap everyday path. The heavier passes run only when there is
    a reason to expect a face — the frame is badly lit, or the cheap pass found
    a weak hit — so an empty lobby costs one detection instead of three, and
    the student standing at the camera is not queued behind work wasted on
    nobody. The cost of every frame is measured so the real speed on the
    school's own PC can be read from /health.
    """
    global _big_pass_at
    t0 = time.perf_counter()
    dets, kpss = face_app.detect(bgr)
    top = max((float(dets[i, 4]) for i in range(dets.shape[0])), default=0.0)
    if top >= det_min:
        PERF.note((time.perf_counter() - t0) * 1000.0)
        return dets, kpss, bgr

    now = time.time()
    light, big = power_profile.pass_plan(POWER_MODE, top, lighting_off(bgr), now, _big_pass_at)
    fixed = normalize_lighting(bgr)
    dets2, kpss2 = dets, kpss
    if light:
        dets2, kpss2 = face_app.detect(fixed)
        top = max(top, max((float(dets2[i, 4]) for i in range(dets2.shape[0])), default=0.0))
        if any(float(dets2[i, 4]) >= det_min for i in range(dets2.shape[0])):
            PERF.note((time.perf_counter() - t0) * 1000.0)
            return dets2, kpss2, fixed

    # Last resort: bigger detector input finds smaller / farther faces.
    if big:
        _big_pass_at = now
        dets3, kpss3 = face_app.detect(fixed, det_size=(512, 512))
        if dets3.shape[0]:
            PERF.note((time.perf_counter() - t0) * 1000.0)
            return dets3, kpss3, fixed

    PERF.note((time.perf_counter() - t0) * 1000.0)
    return dets2 if dets2.shape[0] else dets, kpss2 if dets2.shape[0] else kpss, fixed


def web_faces_payload(bgr: np.ndarray, want_crop: bool = False) -> list[dict]:
    """ผลลัพธ์รูปแบบเดียวกับ FaceGate Agent รุ่นเดิม (หน้าเว็บ /face-kiosk ใช้)."""
    out: list[dict] = []
    for f in face_app.get(bgr):
        x1, y1, x2, y2 = [float(v) for v in f.bbox]
        crop = bgr[max(int(y1), 0):max(int(y2), 0), max(int(x1), 0):max(int(x2), 0)]
        sharp = laplacian_sharpness(crop) if crop.size else 0.0
        spread = float(np.std(crop.reshape(-1, 3), axis=0).mean()) if crop.size else 0.0
        item = {
            "box": {"x": max(0.0, x1), "y": max(0.0, y1), "width": x2 - x1, "height": y2 - y1},
            "keypoints": [[float(p[0]), float(p[1])] for p in f.kps],
            "score": float(f.det_score),
            "descriptor": [float(v) for v in f.normed_embedding],
            "geometry": geometry_features(f),
            "live": bool(sharp > 45 and spread > 18),
            "sharpness": round(sharp, 2),
            "colorSpread": round(spread, 2),
        }
        if want_crop:
            item["crop"] = crop_face_jpeg(bgr, f)
        out.append(item)
    out.sort(key=lambda i: i["box"]["width"] * i["box"]["height"], reverse=True)
    return out


# Cloud mode (normal school install): the program opens its own scan screen,
# so nobody has to sign in to the website just to run the scanner.
RECENT_SCANS: list[dict] = []
if not STANDALONE and not SATELLITE:
    import local_ui
    from fastapi.responses import HTMLResponse as _CHTML, RedirectResponse as _CRedirect

    @app.get("/kiosk")
    def kiosk_screen_cloud():
        return _CHTML(local_ui.KIOSK_HTML)

    @app.get("/admin")
    def admin_screen_cloud():
        return _CRedirect("https://bngss.online/dashboard/admin/facegate")

    @app.post("/local/kiosk-api/tts")
    async def cloud_voice(request: Request):
        from fastapi.responses import Response
        from starlette.concurrency import run_in_threadpool
        import local_voice
        body = await request.json()
        text = str(body.get("text") or "").strip()[:300]
        if not text:
            return Response(status_code=400)
        clip = await run_in_threadpool(local_voice.synthesize, text)
        if not clip:
            return Response(status_code=503)
        audio, mime = clip
        return Response(content=audio, media_type=mime)

    @app.get("/")
    def home_screen_cloud():
        return _CRedirect("/kiosk")

    _cloud_cache: dict[str, Any] = {}

    def _cloud_get(route: str, fallback):
        """Screen data from the school backend (CMS + settings); last good copy offline."""
        if DEVICE_KEY:
            try:
                res = requests.get(f"{CLOUD_URL}/kiosk-api/{route}", headers=HEADERS, timeout=6)
                if res.ok:
                    _cloud_cache[route] = res.json()
                    return _cloud_cache[route]
            except Exception:  # noqa: BLE001
                pass
        return _cloud_cache.get(route) or fallback()

    def _local_content():
        with lock:
            st = dict(state.get("settings") or {})
        out = {k: v for k, v in st.items() if isinstance(v, (str, int, float, bool)) or v is None}
        if not DEVICE_KEY:
            out["kiosk_subtitle"] = "ยังไม่ได้ใส่ Device Key — สแกนได้แต่ยังไม่ส่งข้อมูลเข้าระบบ"
        return out

    def _local_recent():
        today = time.strftime("%Y-%m-%d")
        return {"display": {"show_recent": True}, "items": [r for r in RECENT_SCANS if r["scanned_at"].startswith(today)][:12]}

    def _local_stats():
        today = time.strftime("%Y-%m-%d")
        seen = {r["id"] for r in RECENT_SCANS if r["scanned_at"].startswith(today) and r["direction"] != "out"}
        return {"students_present": len(seen), "staff_present": 0, "server_time": None,
                "visitor_register_enabled": False}

    @app.get("/local/kiosk-api/content")
    def cloud_content():
        return _cloud_get("content", _local_content)

    @app.get("/local/kiosk-api/recent")
    def cloud_recent():
        result = dict(_cloud_get("recent", _local_recent))
        result["voice_test_at"] = state.get("voice_test_at")
        return result

    @app.get("/local/kiosk-api/today-stats")
    def cloud_today_stats():
        return _cloud_get("today-stats", _local_stats)

    @app.get('/local/api/public/visit/qr.svg')
    def cloud_visit_qr():
        import qrcode
        import qrcode.image.svg
        from fastapi.responses import Response
        output = io.BytesIO()
        qrcode.make('https://bngss.online/visit', image_factory=qrcode.image.svg.SvgPathImage).save(output)
        return Response(content=output.getvalue(), media_type='image/svg+xml')

    @app.post("/local/kiosk-api/live")
    async def cloud_live(request: Request):
        try:
            body = await request.json()
            res = requests.post(f"{CLOUD_URL}/kiosk-api/live", headers=HEADERS, json=body, timeout=8)
            return res.json()
        except Exception:  # noqa: BLE001
            return {"ok": False, "watch": False, "interval_ms": 2000}


def remember_scan(result: dict) -> None:
    """Keep the last scans in memory for the program's own scan screen."""
    if not isinstance(result, dict) or result.get("result") != "ok" or result.get("test"):
        return
    sid = result.get("student_id") or result.get("name") or ""
    with lock:
        person = state["students"].get(sid) or {}
    RECENT_SCANS.insert(0, {
        "id": sid,
        "name": result.get("name") or person.get("full_name") or "ผู้ใช้งาน",
        "detail": result.get("detail") or person.get("class_name") or "",
        "avatar_url": person.get("avatar_url") or "",
        "direction": result.get("direction") or "in",
        "scanned_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
    })
    del RECENT_SCANS[50:]


def decode_image(raw: bytes) -> np.ndarray | None:
    return cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)


import native_camera  # noqa: E402


@app.get("/camera/status")
def camera_status():
    return native_camera.status()


@app.get("/camera/frame.jpg")
def camera_frame(rotate: int = 0):
    from fastapi.responses import Response as _Resp
    data = native_camera.jpeg(rotate, 70)
    if data is None:
        return _Resp(status_code=503)
    return _Resp(content=data, media_type="image/jpeg", headers={"cache-control": "no-store"})


@app.get("/camera/stream")
def camera_stream():
    """MJPEG preview of the direct camera for the scan screen."""
    from fastapi.responses import StreamingResponse

    def gen():
        while True:
            data = native_camera.jpeg(0, 70)
            if data:
                yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + data + b"\r\n"
            time.sleep(0.066)

    return StreamingResponse(gen(), media_type="multipart/x-mixed-replace; boundary=frame")


@app.post("/scan")
async def scan(request: Request):
    """คีออส (JSON {image}) = สแกน+บันทึกเวลา / หน้าเว็บ (raw JPEG) = ตรวจจับ+embedding."""
    ctype = (request.headers.get("content-type") or "").lower()
    body = await request.body()
    if "application/json" in ctype:
        payload = json.loads(body or b"{}") or {}
        image = payload.get("image") or ""
        if not image and payload.get("native"):
            from starlette.concurrency import run_in_threadpool
            img = native_camera.latest(int(payload.get("rotate") or 0))
            if img is None:
                return {"result": "no_camera", "message": "ไม่พบกล้อง กรุณาตรวจสายกล้อง"}
            ok_jpg, buf = cv2.imencode(".jpg", img, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
            image = base64.b64encode(buf).decode() if ok_jpg else ""
            push_live_frame(image)
            result = await run_in_threadpool(run_scan, image, None, False, payload.get("guide"))
            remember_scan(result)
            if result.get("result") in ("ok", "duplicate", "denied"):
                result["snapshot_b64"] = image
            return result
        push_live_frame(image)
        result = run_scan(image, guide=payload.get("guide"))
        remember_scan(result)
        return result
    # เส้นทางเข้ากันได้กับรุ่นเดิม: รับ JPEG ดิบ คืนใบหน้าพร้อม embedding
    t0 = time.time()
    img = decode_image(body)
    if img is None:
        return {"faces": [], "error": "decode_failed"}
    faces = web_faces_payload(img)
    return {"faces": faces, "faceCount": len(faces), "ms": round((time.time() - t0) * 1000, 1)}


class EmbedRequest(BaseModel):
    image: str
    crop: bool = False


@app.post("/embed")
def embed(req: EmbedRequest):
    """ใช้ตอนลงทะเบียนใบหน้าบนหน้าเว็บ — คืน embedding 512 มิติ + รูปครอป."""
    t0 = time.time()
    raw = (req.image or "").split(",", 1)[-1]
    try:
        img = decode_image(base64.b64decode(raw))
    except Exception:  # noqa: BLE001
        img = None
    if img is None:
        return {"faces": [], "error": "decode_failed"}
    return {"faces": web_faces_payload(img, want_crop=req.crop), "ms": round((time.time() - t0) * 1000, 1)}



@app.post("/test/scan")
def test_scan(req: ScanRequest):
    """Recognise a face and drive the door, but never record attendance.

    Used by the backend "test scan + door" screen so staff can verify the
    micro:bit reacts to a successful match without polluting the history.
    """
    return run_scan(req.image, dry_run=True)


_qr_guard = qr_reader.RepeatGuard(hold_s=6.0)


def scan_card_qr(arr: np.ndarray, direction: str | None, dry_run: bool, delay: int) -> dict | None:
    """Record attendance from the QR on a student card; None when no card QR."""
    text = qr_reader.read_qr(arr)
    if not text:
        return None
    with lock:
        people = dict(state["students"])
    person_id = qr_reader.match_card(text, qr_reader.build_code_index(people))
    if not person_id:
        return {
            "result": "denied",
            "message": "QR นี้ไม่ใช่บัตรนักเรียนของโรงเรียน",
            "speak": "ไม่พบข้อมูลบัตรนี้",
            "next_delay_seconds": 2,
        }
    if not _qr_guard.allow(person_id):
        return {"result": "no_face", "message": ""}
    name = (people.get(person_id) or {}).get("full_name") or "ผู้ใช้งาน"
    if dry_run:
        return {"result": "ok", "test": True, "student_id": person_id, "name": name,
                "message": f"อ่านบัตรได้: {name} (ไม่บันทึกประวัติ)", "next_delay_seconds": 0}
    payload: dict[str, Any] = {"student_id": person_id, "method": "qr"}
    if direction in ("in", "out"):
        payload["direction"] = direction
    photo = qr_reader.frame_evidence_jpeg(arr)
    if photo:
        payload["snapshot"] = base64.b64encode(photo).decode()
    with lock:
        settings = dict(state["settings"])
    return submit_attendance_fast(payload, settings, delay)


def run_scan(image: str, direction: str | None = None, dry_run: bool = False, guide=None):
    return completed_result(_run_scan(image, direction, dry_run, guide))


def _run_scan(image: str, direction: str | None = None, dry_run: bool = False, guide=None):
    raw = image.split(",", 1)[-1]
    arr = cv2.imdecode(np.frombuffer(base64.b64decode(raw), np.uint8), cv2.IMREAD_COLOR)
    with lock:
        state["camera_ok"] = arr is not None
    if arr is None:
        return {"result": "no_face", "message": ""}

    with lock:
        matrix = state["matrix"]
        owners = list(state["owners"])
        geoms = list(state["geoms"])
        settings = dict(state["settings"])

    threshold = float(settings.get("match_threshold") or 0.45)
    delay = NEXT_PERSON_SECONDS
    det_min = float(settings.get("detector_min_score") or 0.5)
    min_coverage = float(settings.get("min_face_coverage") or 0.0)

    if scene_is_static(arr):
        return {
            "result": "no_face",
            "message": "",
            "face_detection": _motion.get("visual"),
        }

    # Student-card QR fallback for faces that are hard to recognise.
    if settings.get("qr_card_enabled", True):
        card = scan_card_qr(arr, direction, dry_run, delay)
        if card is not None:
            if card.get("result") != "no_face":
                power.note_presence()
                with lock:
                    state["last_activity"] = time.time()
            return card

    # Detect only (cheap); the expensive embedding runs for one face at most.
    dets, kpss, arr = detect_adaptive(arr, det_min)
    strong = [i for i in range(dets.shape[0]) if float(dets[i, 4]) >= det_min]
    if not strong:
        _motion["visual"] = None
        return {"result": "no_face", "message": ""}

    frame_h, frame_w = float(arr.shape[0]), float(arr.shape[1])
    frame_area = frame_h * frame_w
    areas = {
        i: float((dets[i, 2] - dets[i, 0]) * (dets[i, 3] - dets[i, 1])) for i in strong
    }
    # Only faces big enough to matter count as "people standing at the kiosk".
    big = [i for i in strong if areas[i] / frame_area >= max(min_coverage, 0.01)]
    if not big:
        return {
            "result": "no_face",
            "message": "กรุณาเข้าใกล้กล้องอีกนิด",
        }

    # Wake before recognition and guide filtering so an approaching person
    # can see where to stand, including faces not registered yet.
    power.note_presence()
    with lock:
        state["last_activity"] = time.time()

    # The whole detected face must fit the visible rectangle, not just its centre.
    # Filter before embedding so outside faces are never recognised or recorded.
    present = [i for i in big if face_inside(dets[i, :4], frame_w, frame_h, guide)]
    if not present:
        _motion["visual"] = None
        return {
            "result": "no_face",
            "message": "กรุณาจัดใบหน้าให้อยู่ในกรอบ",
            "has_face": True,
        }
    # Queue scanning: when several faces are inside the guide, scan the
    # largest one — that is the person who stepped up to the camera. People
    # waiting behind are ignored instead of blocking the queue, so each
    # student takes seconds even when the next in line is already in view.
    idx = max(present, key=lambda i: areas[i])
    visual = detection_payload(dets, kpss, idx, frame_w, frame_h)
    _motion["visual"] = visual
    face = Face(
        bbox=dets[idx, :4],
        kps=kpss[idx],
        det_score=float(dets[idx, 4]),
        normed_embedding=face_app.embed(arr, kpss[idx]),
    )

    if settings.get("require_liveness") and not looks_like_a_real_person(arr, face):
        return {
            "result": "denied",
            "message": "ตรวจพบว่าไม่ใช่บุคคลจริง",
            "speak": "ไม่สามารถยืนยันตัวตนได้ กรุณามองกล้องอีกครั้ง",
            "next_delay_seconds": delay,
            "face_detection": visual,
        }

    if matrix.shape[0] == 0:
        return {
            "result": "denied",
            "message": "ยังไม่มีข้อมูลใบหน้าในระบบ",
            "speak": "ยังไม่มีข้อมูลใบหน้าในระบบ",
            "next_delay_seconds": delay,
            "face_detection": visual,
        }

    query = normalise(face.normed_embedding)
    live_geometry = geometry_features(face)
    geo_weight = float(settings.get("geometry_weight") or 0.0)

    scores = matrix @ query
    combined = scores.astype(np.float32, copy=True)
    geo_per_row: list[float | None] = [None] * len(owners)

    # Geometry is only worth computing for the few rows that already look close
    # to the live face — comparing every photo wastes CPU on the kiosk PC.
    if live_geometry and geo_weight > 0:
        top = np.argsort(scores)[::-1][: min(len(owners), 30)]
        for i in top:
            sim = geometry_similarity(live_geometry, geoms[int(i)])
            geo_per_row[int(i)] = sim
            if sim is not None:
                combined[int(i)] = (1.0 - geo_weight) * scores[int(i)] + geo_weight * sim

    # Decide per person, not per photo: a student with several good photos
    # should beat a stranger who happens to match one odd-angle photo.
    per_student: dict[str, float] = {}
    for i, owner in enumerate(owners):
        value = float(combined[i])
        if value > per_student.get(owner, -2.0):
            per_student[owner] = value

    ranked = sorted(per_student.items(), key=lambda kv: kv[1], reverse=True)
    student_id, best_score = ranked[0]
    runner_up = ranked[1][1] if len(ranked) > 1 else -1.0

    if best_score < threshold:
        snapshot = crop_face_jpeg(arr, face)
        failure = note_failed_scan(snapshot)
        if settings.get("visitor_mode"):
            visitor = log_visitor(snapshot, direction)
            if visitor:
                return {**visitor, "face_detection": visual}
        return door_react({
            "result": "denied",
            "message": (
                "ท่านกำลังพยายามบุกรุกโรงเรียน ทางเราจำเป็นต้องใช้มาตรการรักษาความปลอดภัย"
                if failure.get("escalated")
                else "ท่านไม่ใช่บุคลากรหรือนักเรียนของเรา กรุณาติดต่อเจ้าหน้าที่"
            ),
            "speak": (
                "ท่านกำลังพยายามบุกรุกโรงเรียน ทางเราจำเป็นต้องใช้มาตรการรักษาความปลอดภัย"
                if failure.get("escalated")
                else settings.get("voice_denied_text") or "ท่านไม่ใช่บุคลากรหรือนักเรียนของเรา กรุณาติดต่อเจ้าหน้าที่"
            ),
            "next_delay_seconds": delay,
            "face_detection": visual,
        })

    # Two people scoring almost the same means the frame is not good enough to
    # tell them apart — ask for another scan instead of guessing.
    if best_score - runner_up < 0.04 and runner_up > 0:
        return {
            "result": "denied",
            "message": "ภาพไม่ชัดพอ กรุณามองกล้องตรงๆ อีกครั้ง",
            "speak": "กรุณามองกล้องอีกครั้ง",
            "next_delay_seconds": 2,
            "face_detection": visual,
        }

    rows_of_student = [i for i, owner in enumerate(owners) if owner == student_id]
    confidence = float(max(scores[i] for i in rows_of_student))
    geometry_score = None
    if live_geometry:
        sims = [
            geometry_similarity(live_geometry, geoms[i]) for i in rows_of_student
        ]
        sims = [s for s in sims if s is not None]
        if sims:
            geometry_score = max(sims)

    # Test mode: prove the match and the door reaction, record nothing.
    if dry_run:
        with lock:
            person = state["students"].get(student_id) or {}
        name = person.get("full_name") or "ผู้ใช้งาน"
        return door_react({
            "result": "ok",
            "test": True,
            "student_id": student_id,
            "name": name,
            "confidence": round(confidence, 4),
            "geometry_score": None if geometry_score is None else round(float(geometry_score), 4),
            "message": f"จำใบหน้าได้: {name} (ไม่บันทึกประวัติ)",
            "next_delay_seconds": 0,
            "face_detection": visual,
        })

    payload = {

        "student_id": student_id,
        "confidence": round(confidence, 4),
        "embedding": query.tolist(),
    }
    if direction in ("in", "out"):
        payload["direction"] = direction
    if geometry_score is not None:
        payload["geometry_score"] = round(float(geometry_score), 4)
    if live_geometry:
        payload["geometry"] = live_geometry
    snapshot = crop_face_jpeg(arr, face)
    if snapshot:
        payload["snapshot"] = snapshot

    geo_min = float(settings.get("geometry_min_score") or 0)
    if geometry_score is not None and geo_min > 0 and geometry_score < geo_min:
        return {"result": "denied", "message": "สัดส่วนใบหน้าไม่ตรงกับข้อมูลที่ลงทะเบียนไว้ กรุณาสแกนอีกครั้ง",
                "speak": "กรุณาสแกนอีกครั้ง", "next_delay_seconds": 1, "face_detection": visual}
    return submit_attendance_fast(payload, settings, delay, {"face_detection": visual})


def open_firewall(port: int) -> None:
    """Best-effort: let other PCs on the school network reach this program.

    Windows blocks incoming connections by default, which shows up as
    "refused to connect" in the browser on a teacher's PC. Adding the rule
    needs administrator rights; when it fails we simply carry on.
    """
    if os.name != "nt":
        return
    try:
        import subprocess

        name = f"FaceGate {port}"
        subprocess.run(
            ["netsh", "advfirewall", "firewall", "delete", "rule", f"name={name}"],
            capture_output=True, timeout=15, check=False,
        )
        done = subprocess.run(
            ["netsh", "advfirewall", "firewall", "add", "rule", f"name={name}",
             "dir=in", "action=allow", "protocol=TCP", f"localport={port}",
             "profile=private,domain"],
            capture_output=True, timeout=15, check=False,
        )
        print(f"[agent] firewall rule for port {port}: {'ok' if done.returncode == 0 else 'skipped'}")
    except Exception as exc:  # noqa: BLE001
        print(f"[agent] firewall rule skipped: {exc}")


def open_kiosk_browser() -> None:
    """Open the scan page full screen once the local service answers (exe build)."""
    import subprocess
    time.sleep(5)
    # Always the program's own scan screen — no website sign-in needed.
    url = f"http://127.0.0.1:{PORT}/kiosk"
    candidates = [
        os.path.join(os.environ.get("PROGRAMFILES(X86)", ""), "Microsoft", "Edge", "Application", "msedge.exe"),
        os.path.join(os.environ.get("PROGRAMFILES", ""), "Microsoft", "Edge", "Application", "msedge.exe"),
        os.path.join(os.environ.get("PROGRAMFILES", ""), "Google", "Chrome", "Application", "chrome.exe"),
    ]
    for exe in candidates:
        if exe and os.path.exists(exe):
            # Own browser profile, like the original FaceGate window: opens
            # straight to the scan screen even if Edge is already running.
            profile = os.path.join(CACHE_DIR, "kiosk-browser")
            subprocess.Popen([exe, "--kiosk", url, f"--user-data-dir={profile}",
                              "--no-first-run", "--edge-kiosk-type=fullscreen", "--autoplay-policy=no-user-gesture-required",
                              "--use-fake-ui-for-media-stream", "--disable-background-timer-throttling"])
            return
    import webbrowser
    webbrowser.open(url)


if __name__ == "__main__":
    import uvicorn

    if not DEVICE_KEY and not STANDALONE:
        print("ตั้งค่า FACEGATE_DEVICE_KEY ก่อนเริ่มโปรแกรม (ดูรหัสได้ในหน้าตั้งค่าระบบ)")
    if SATELLITE:
        print(f"[agent] LAN kiosk mode — hub: {HUB_URL}")
    if STANDALONE:
        import local_api

        def embed_photo(jpeg: bytes) -> dict:
            """Turn a registration photo into an ArcFace embedding (local admin)."""
            arr = cv2.imdecode(np.frombuffer(jpeg, np.uint8), cv2.IMREAD_COLOR)
            if arr is None:
                raise ValueError("อ่านไฟล์ภาพไม่ได้")
            face = embed_image(arr)
            if face is None:
                raise ValueError("ไม่พบใบหน้าในภาพนี้ กรุณาถ่ายใหม่ให้เห็นหน้าชัดเจน")
            return {
                "embedding": normalise(np.asarray(face.normed_embedding, dtype=np.float32)).tolist(),
                "geometry": geometry_features(face),
                "quality": round(min(1.0, laplacian_sharpness(arr) / 200.0), 3),
            }

        local_api.set_embedder(embed_photo)
        print(f"[agent] standalone mode — data in {local_api.db.DATA_DIR}")

    clock.sync_now()
    clock.start()
    load_cache()
    door.start()
    threading.Thread(target=sync_loop, daemon=True).start()
    threading.Thread(target=outbox_loop, daemon=True).start()
    threading.Thread(target=command_loop, daemon=True).start()
    threading.Thread(target=power_loop, daemon=True).start()
    threading.Thread(target=update_loop, daemon=True).start()
    threading.Thread(target=second_camera_loop, daemon=True).start()
    native_camera.start()

    def warm_engine() -> None:
        try:
            get_engine()
            print("[agent] face models ready")
        except Exception as exc:  # noqa: BLE001
            print(f"[agent] loading face models failed: {exc}")

    threading.Thread(target=warm_engine, daemon=True).start()

    # The standalone PC always answers the school LAN so staff can open the
    # reports from another computer without restarting anything. Access still
    # needs an admin login, and satellites still need a device key.
    host = "127.0.0.1"
    if os.environ.get("FACEGATE_BIND"):
        host = os.environ["FACEGATE_BIND"]
    else:
        # Every install answers the school LAN so tablets (BNG Scanner) can use
        # this PC's face engine; the normal school install used to listen only
        # on itself, which made tablets show "cannot reach FaceGate".
        host = "0.0.0.0"  # noqa: S104 — school LAN only
        try:
            open_firewall(PORT)
        except Exception as exc:  # noqa: BLE001
            print(f"[agent] opening the network port failed: {exc}")
        if STANDALONE:
            try:
                import local_api

                # The address shown in the admin site must be the port we really
                # listen on, otherwise staff type a port nothing answers on.
                local_api.db.save_settings({"lan_port": PORT})
            except Exception as exc:  # noqa: BLE001
                print(f"[agent] saving the LAN port failed: {exc}")
        print(f"[agent] LAN ready — open http://<this-pc-ip>:{PORT}/admin")

    want_window = (FROZEN or os.environ.get("FACEGATE_NATIVE_WINDOW") == "1") and os.environ.get("FACEGATE_OPEN_KIOSK", "1") not in ("0", "false", "off", "no")
    server = None
    if want_window:
        # Native full-screen window (like the original FaceGate program) — no
        # web browser. Face recognition itself always runs in this program.
        try:
            import webview  # pywebview → Windows WebView2 / Linux WebKitGTK

            os.environ.setdefault(
                "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
                "--use-fake-ui-for-media-stream --autoplay-policy=no-user-gesture-required "
                "--disable-background-timer-throttling --disable-renderer-backgrounding",
            )
            server = threading.Thread(
                target=lambda: uvicorn.run(app, host=host, port=PORT), daemon=True
            )
            server.start()
            for _ in range(60):  # wait until the scan page answers
                try:
                    if requests.get(f"http://127.0.0.1:{PORT}/health", timeout=1).ok:
                        break
                except Exception:  # noqa: BLE001
                    time.sleep(0.5)
            class KioskWindowApi:
                def open_admin(self):
                    import webbrowser
                    target = f"http://127.0.0.1:{PORT}/admin" if STANDALONE else "https://bngss.online/dashboard/admin/facegate"
                    webbrowser.open(target)
                    return True

            webview.create_window(
                "BNG FaceGate", f"http://127.0.0.1:{PORT}/kiosk",
                fullscreen=True, frameless=True, background_color="#000000", js_api=KioskWindowApi(),
            )
            webview.start(private_mode=False, storage_path=os.path.join(CACHE_DIR, "window"))
            os._exit(0)  # window closed → stop the program
        except Exception as exc:  # noqa: BLE001
            print(f"[agent] native window unavailable, using browser: {exc}")
            threading.Thread(target=open_kiosk_browser, daemon=True).start()
            if server is not None and server.is_alive():
                server.join()
                raise SystemExit(0)

    uvicorn.run(app, host=host, port=PORT)
