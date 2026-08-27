#!/usr/bin/env python3
"""
Face sidecar — ตัวช่วยประมวลผลใบหน้าบนเครื่องคีออส (Intel iGPU / OpenVINO)

หน้าที่:
  GET  /health          → {"ok": true, "provider": "OpenVINOExecutionProvider"}
  POST /detect          → รับ JPEG (raw body) คืนกล่องใบหน้าที่พบ (เร็วมาก, ใช้เป็น pre-filter)
  POST /embed           → รับ JPEG คืน embedding 512 มิติ (ArcFace) ต่อใบหน้า

เว็บ (Kiosk Door) จะเรียก /detect ก่อนเพื่อคัดเฟรมว่าง — เฟรมที่ไม่มีคนจะไม่ถูกส่งเข้า
pipeline หนักในเบราว์เซอร์ ทำให้ CPU ลดลงมากบนเครื่องสเปกเบา และตอบสนองไวขึ้น 2–4 เท่า
ถ้า sidecar ไม่ทำงาน เว็บจะกลับไปใช้การประมวลผลในเบราว์เซอร์เองอัตโนมัติ

รัน: python3 server.py  (พอร์ตเริ่มต้น 8765, ฟังเฉพาะ 127.0.0.1)
"""
import io
import os
import time
from typing import List

import numpy as np
import cv2
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

MODEL_DIR = os.environ.get("FACE_MODEL_DIR", os.path.join(os.path.dirname(__file__), "models"))
YUNET = os.path.join(MODEL_DIR, "face_detection_yunet_2023mar.onnx")
ARCFACE = os.path.join(MODEL_DIR, "arcface_r50.onnx")
PORT = int(os.environ.get("FACE_SIDECAR_PORT", "8765"))

app = FastAPI(title="Kiosk Face Sidecar")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ฟังเฉพาะ localhost อยู่แล้ว
    allow_methods=["*"],
    allow_headers=["*"],
)

_detector = None
_embedder = None
_provider = "none"


def get_detector():
    global _detector
    if _detector is None:
        if not os.path.exists(YUNET):
            raise FileNotFoundError(f"ไม่พบโมเดลตรวจจับใบหน้า: {YUNET}")
        _detector = cv2.FaceDetectorYN.create(YUNET, "", (320, 320), 0.6, 0.3, 5000)
    return _detector


def get_embedder():
    """ArcFace ผ่าน onnxruntime — ใช้ OpenVINO EP บน Intel iGPU ถ้ามี"""
    global _embedder, _provider
    if _embedder is None:
        import onnxruntime as ort

        if not os.path.exists(ARCFACE):
            return None
        available = ort.get_available_providers()
        for want in ("OpenVINOExecutionProvider", "DmlExecutionProvider", "CPUExecutionProvider"):
            if want in available:
                _provider = want
                break
        so = ort.SessionOptions()
        so.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        so.intra_op_num_threads = max(1, (os.cpu_count() or 2))
        _embedder = ort.InferenceSession(ARCFACE, sess_options=so, providers=[_provider])
    return _embedder


def decode(body: bytes):
    arr = np.frombuffer(body, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("decode ภาพไม่สำเร็จ")
    return img


def detect_faces(img) -> List[dict]:
    det = get_detector()
    h, w = img.shape[:2]
    det.setInputSize((w, h))
    _, faces = det.detect(img)
    out = []
    if faces is None:
        return out
    for f in faces:
        x, y, fw, fh = f[0:4]
        out.append({
            "x": float(max(0, x)), "y": float(max(0, y)),
            "width": float(fw), "height": float(fh),
            "score": float(f[-1]),
        })
    return out


@app.get("/health")
def health():
    try:
        get_detector()
        det_ok = True
    except Exception:
        det_ok = False
    emb = None
    try:
        emb = get_embedder()
    except Exception:
        emb = None
    return {"ok": det_ok, "detector": det_ok, "embedder": emb is not None, "provider": _provider}


@app.post("/detect")
async def detect(request: Request):
    t0 = time.time()
    img = decode(await request.body())
    faces = detect_faces(img)
    return {"faces": faces, "ms": round((time.time() - t0) * 1000, 1)}


@app.post("/embed")
async def embed(request: Request):
    t0 = time.time()
    img = decode(await request.body())
    sess = get_embedder()
    if sess is None:
        return {"error": "no_embedder", "faces": []}
    faces = detect_faces(img)
    results = []
    iname = sess.get_inputs()[0].name
    for f in faces:
        x, y, w, h = int(f["x"]), int(f["y"]), int(f["width"]), int(f["height"])
        crop = img[max(0, y):y + h, max(0, x):x + w]
        if crop.size == 0:
            continue
        blob = cv2.resize(crop, (112, 112)).astype(np.float32)
        blob = (blob - 127.5) / 127.5
        blob = np.transpose(blob, (2, 0, 1))[None, ...]
        vec = sess.run(None, {iname: blob})[0][0]
        vec = vec / (np.linalg.norm(vec) + 1e-9)
        results.append({"box": f, "descriptor": [float(v) for v in vec]})
    return {"faces": results, "provider": _provider, "ms": round((time.time() - t0) * 1000, 1)}


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="warning")
