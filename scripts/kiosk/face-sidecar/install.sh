#!/usr/bin/env bash
# ติดตั้ง Face Sidecar (ONNX Runtime + OpenVINO) บนเครื่องคีออส
#   sudo bash install.sh
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "ต้องรันด้วย sudo"; exit 1; }

SRC_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR=/opt/kiosk-face-sidecar
MODEL_DIR="$APP_DIR/models"

apt-get update -y
apt-get install -y --no-install-recommends python3 python3-pip python3-venv curl

mkdir -p "$MODEL_DIR"
cp "$SRC_DIR/server.py" "$APP_DIR/server.py"

python3 -m venv "$APP_DIR/venv"
"$APP_DIR/venv/bin/pip" install --upgrade pip
"$APP_DIR/venv/bin/pip" install -r "$SRC_DIR/requirements.txt"
# OpenVINO EP (Intel iGPU) — ถ้าลงไม่ได้ก็ใช้ CPU EP ต่อได้
"$APP_DIR/venv/bin/pip" install onnxruntime-openvino || echo "!! ใช้ CPU EP แทน OpenVINO"

echo "==> ดาวน์โหลดโมเดล"
[ -f "$MODEL_DIR/face_detection_yunet_2023mar.onnx" ] || curl -fsSL \
  "https://raw.githubusercontent.com/opencv/opencv_zoo/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx" \
  -o "$MODEL_DIR/face_detection_yunet_2023mar.onnx"
# ArcFace (ตัวเลือก) — ถ้าไม่มี sidecar จะทำหน้าที่แค่ตรวจจับใบหน้า
[ -f "$MODEL_DIR/arcface_r50.onnx" ] || curl -fsSL \
  "https://raw.githubusercontent.com/opencv/opencv_zoo/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx" \
  -o "$MODEL_DIR/arcface_r50.onnx" || echo "!! ข้าม embedder"

cat >/etc/systemd/system/kiosk-face-sidecar.service <<UNIT
[Unit]
Description=Kiosk Face Sidecar (ONNX Runtime / OpenVINO)
After=network.target

[Service]
Type=simple
Environment=FACE_MODEL_DIR=$MODEL_DIR
Environment=FACE_SIDECAR_PORT=8765
ExecStart=$APP_DIR/venv/bin/python $APP_DIR/server.py
Restart=always
RestartSec=3
Nice=-5

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now kiosk-face-sidecar.service
sleep 2
curl -s http://127.0.0.1:8765/health || echo "!! sidecar ยังไม่ตอบ — ดู journalctl -u kiosk-face-sidecar"
echo
echo "เสร็จแล้ว ✅ sidecar ทำงานที่ http://127.0.0.1:8765"
