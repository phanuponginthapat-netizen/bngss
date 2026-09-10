#!/usr/bin/env bash
# ติดตั้ง FaceGate Agent (สแกนใบหน้าแบบเนทีฟ) บนเครื่องคีออส Linux
#   sudo bash install.sh
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "ต้องรันด้วย sudo"; exit 1; }

SRC_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR=/opt/facegate-agent
MODEL_DIR="$APP_DIR/models"
HF=https://huggingface.co/deepghs/insightface/resolve/main/buffalo_s

apt-get update -y
apt-get install -y --no-install-recommends python3 python3-pip python3-venv curl

mkdir -p "$MODEL_DIR"
cp "$SRC_DIR/agent.py" "$SRC_DIR/face_engine.py" "$APP_DIR/"

python3 -m venv "$APP_DIR/venv"
"$APP_DIR/venv/bin/pip" install --upgrade pip
"$APP_DIR/venv/bin/pip" install -r "$SRC_DIR/requirements.txt"
# OpenVINO EP (Intel iGPU) — ถ้าลงไม่ได้ก็ใช้ CPU ต่อได้
"$APP_DIR/venv/bin/pip" install onnxruntime-openvino || echo "!! ใช้ CPU แทน OpenVINO"

echo "==> ดาวน์โหลดโมเดล (ครั้งเดียว ~17 MB)"
[ -f "$MODEL_DIR/det_500m.onnx" ]  || curl -fsSL "$HF/det_500m.onnx"  -o "$MODEL_DIR/det_500m.onnx"
[ -f "$MODEL_DIR/w600k_mbf.onnx" ] || curl -fsSL "$HF/w600k_mbf.onnx" -o "$MODEL_DIR/w600k_mbf.onnx"

cat >/etc/systemd/system/facegate-agent.service <<UNIT
[Unit]
Description=FaceGate Agent (native face scan for BNGSS kiosk)
After=network.target

[Service]
Type=simple
Environment=FACEGATE_MODEL_DIR=$MODEL_DIR
Environment=FACEGATE_PORT=8899
ExecStart=$APP_DIR/venv/bin/python $APP_DIR/agent.py
WorkingDirectory=$APP_DIR
Restart=always
RestartSec=3
Nice=-5

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now facegate-agent.service
sleep 3
curl -s http://127.0.0.1:8899/health || echo "!! agent ยังไม่ตอบ — ดู journalctl -u facegate-agent"
echo
echo "เสร็จแล้ว ✅ เปิดหน้า /face-kiosk บนเครื่องนี้ ระบบจะใช้ตัวประมวลผลเนทีฟอัตโนมัติ"
