"""
FaceGate Agent — ตัวประมวลผลใบหน้าแบบเนทีฟบนเครื่องคีออส
=========================================================
รันคู่กับหน้าเว็บคีออส (/face-kiosk) บนเครื่องเดียวกัน แล้วรับหน้าที่
"ตรวจจับใบหน้า + คำนวณ embedding" แทนการทำในเบราว์เซอร์

ทำไมถึงแม่นกว่า:
  * ตรวจจับด้วย SCRFD (det_500m) แทน SSD/Tiny ของ face-api → ได้จุดสังเกต 5 จุดตรงตำแหน่งจริง
  * จัดหน้าตามเทมเพลต ArcFace มาตรฐาน แล้วคำนวณด้วย w600k_mbf (512 มิติ)
    ซึ่งเป็น "โมเดลตัวเดียวกัน" กับที่เว็บใช้ → embedding เทียบกับที่ลงทะเบียนไว้ได้ทันที
  * รันบน onnxruntime เนทีฟ (CPU/OpenVINO) เร็วกว่า WASM ในเบราว์เซอร์หลายเท่า

ความเป็นส่วนตัว: ทำงานเฉพาะบนเครื่อง (127.0.0.1) ไม่ส่งภาพออกอินเทอร์เน็ต
การจับคู่ตัวตนและการบันทึกเวลายังทำที่หน้าเว็บเหมือนเดิม

รัน:  python agent.py     (ค่าเริ่มต้นพอร์ต 8899)
"""

from __future__ import annotations

import base64
import os
import time

import cv2
import numpy as np
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from face_engine import FaceEngine

PORT = int(os.environ.get("FACEGATE_PORT", "8899"))
DET_SIZE = int(os.environ.get("FACEGATE_DET_SIZE", "320"))
DET_THRESH = float(os.environ.get("FACEGATE_DET_THRESH", "0.5"))

app = FastAPI(title="FaceGate Agent (BNGSS Kiosk)")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ฟังเฉพาะ localhost อยู่แล้ว
    allow_methods=["*"],
    allow_headers=["*"],
)

engine: FaceEngine | None = None


def get_engine() -> FaceEngine:
    global engine
    if engine is None:
        engine = FaceEngine(det_size=(DET_SIZE, DET_SIZE), det_thresh=DET_THRESH)
    return engine


def decode(data: bytes) -> np.ndarray | None:
    arr = np.frombuffer(data, dtype=np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)


def decode_data_url(value: str) -> np.ndarray | None:
    raw = value.split(",", 1)[-1]
    try:
        return decode(base64.b64decode(raw))
    except Exception:
        return None


def sharpness(bgr: np.ndarray) -> float:
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def liveness(bgr: np.ndarray, bbox) -> dict:
    """กันรูปถ่าย/จอมือถือแบบเบา ๆ — ภาพพิมพ์/จอจะแบนและสีกระจายน้อย"""
    x1, y1, x2, y2 = [int(v) for v in bbox]
    crop = bgr[max(y1, 0):max(y2, 0), max(x1, 0):max(x2, 0)]
    if crop.size == 0:
        return {"live": False, "sharpness": 0.0, "colorSpread": 0.0}
    sharp = sharpness(crop)
    spread = float(np.std(crop.reshape(-1, 3), axis=0).mean())
    return {
        "live": bool(sharp > 45 and spread > 18),
        "sharpness": round(sharp, 2),
        "colorSpread": round(spread, 2),
    }



# ── สัดส่วนโครงหน้า (จุดสังเกต 5 จุด) ───────────────────────────────────────
# ทุกระยะหารด้วยระยะห่างระหว่างตาสองข้าง จึงไม่ขึ้นกับระยะยืน/ขนาดภาพ
# ใช้เป็น "ความเห็นที่สอง" ของการจับคู่ กันจำผิดคนกับคนหน้าคล้าย
GEOMETRY_KEYS = [
    "nose_left_eye", "nose_right_eye", "nose_eye_mid", "mouth_width",
    "nose_mouth_mid", "eye_mid_mouth_mid", "left_eye_mouth_left",
    "right_eye_mouth_right", "face_width", "face_height", "eye_asymmetry",
]


def geometry_features(kps, bbox) -> dict | None:
    if kps is None or len(kps) < 5:
        return None
    pts = np.array(kps, dtype=np.float32)
    left_eye, right_eye, nose, mouth_l, mouth_r = pts[0], pts[1], pts[2], pts[3], pts[4]
    eye_dist = float(np.linalg.norm(right_eye - left_eye))
    if eye_dist < 1e-3:
        return None
    eye_mid = (left_eye + right_eye) / 2.0
    mouth_mid = (mouth_l + mouth_r) / 2.0
    x1, y1, x2, y2 = [float(v) for v in bbox]
    d = lambda a, b: float(np.linalg.norm(a - b)) / eye_dist  # noqa: E731
    nose_l, nose_r = d(nose, left_eye), d(nose, right_eye)
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


def faces_payload(img: np.ndarray, want_crop: bool = False) -> list[dict]:
    out: list[dict] = []
    for f in get_engine().get(img):
        x1, y1, x2, y2 = [float(v) for v in f.bbox]
        item = {
            "box": {"x": max(0.0, x1), "y": max(0.0, y1), "width": x2 - x1, "height": y2 - y1},
            "keypoints": [[float(p[0]), float(p[1])] for p in f.kps],
            "score": float(f.det_score),
            "descriptor": [float(v) for v in f.normed_embedding],
            "geometry": geometry_features(f.kps, f.bbox),
            **liveness(img, f.bbox),
        }
        if want_crop:
            item["crop"] = crop_jpeg(img, f.bbox)
        out.append(item)
    out.sort(key=lambda i: i["box"]["width"] * i["box"]["height"], reverse=True)
    return out


def crop_jpeg(bgr: np.ndarray, bbox, margin: float = 0.35) -> str | None:
    x1, y1, x2, y2 = [int(v) for v in bbox]
    w, h = x2 - x1, y2 - y1
    mx, my = int(w * margin), int(h * margin)
    crop = bgr[max(y1 - my, 0): y2 + my, max(x1 - mx, 0): x2 + mx]
    if crop.size == 0:
        return None
    if crop.shape[0] > 480:
        scale = 480 / crop.shape[0]
        crop = cv2.resize(crop, (int(crop.shape[1] * scale), 480))
    ok, buf = cv2.imencode(".jpg", crop, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
    return ("data:image/jpeg;base64," + base64.b64encode(buf).decode()) if ok else None


@app.get("/health")
def health():
    try:
        get_engine()
        return {"ok": True, "engine": "scrfd_500m+w600k_mbf", "version": "3.2", "geometry": True, "dim": 512, "detSize": DET_SIZE}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)[:300]}


@app.post("/scan")
async def scan(request: Request):
    """รับ JPEG (raw body) — คืนใบหน้าทั้งหมดพร้อม embedding 512 มิติ"""
    t0 = time.time()
    img = decode(await request.body())
    if img is None:
        return {"faces": [], "error": "decode_failed"}
    faces = faces_payload(img)
    return {"faces": faces, "faceCount": len(faces), "ms": round((time.time() - t0) * 1000, 1)}


class ImageRequest(BaseModel):
    image: str
    crop: bool = False


@app.post("/embed")
def embed(req: ImageRequest):
    """รับ data URL (ใช้ตอนลงทะเบียนใบหน้า) — คืน embedding + รูปครอป"""
    t0 = time.time()
    img = decode_data_url(req.image)
    if img is None:
        return {"faces": [], "error": "decode_failed"}
    return {"faces": faces_payload(img, want_crop=req.crop), "ms": round((time.time() - t0) * 1000, 1)}


if __name__ == "__main__":
    import uvicorn

    get_engine()
    print(f"[facegate] พร้อมใช้งานที่ http://127.0.0.1:{PORT}")
    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="warning")
