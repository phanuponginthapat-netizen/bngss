#!/usr/bin/env bash
# อัปเดตระบบเป็นรุ่นล่าสุด (สำรองก่อนทุกครั้ง): sudo school-update
set -euo pipefail
. /etc/school-stack.env 2>/dev/null || true; STACK="${STACK:-/opt/school-stack}"
REPO="$(cat "$STACK/repo-path")"
/usr/local/bin/school-backup
if [ -d "$REPO/.git" ]; then cd "$REPO" && git pull --ff-only; else echo "ติดตั้งจาก setup.exe: ใช้ไฟล์ชุดล่าสุดที่ setup.exe วางไว้ (ดาวน์โหลด setup.exe ใหม่แล้วติดตั้งทับเพื่ออัปเดต)"; fi
MODE=$(grep -oP '(?<=MODE=)\w+' "$STACK/backup.env" || echo standalone)
FLAG=""; [ "$MODE" = "hybrid" ] && FLAG="--hybrid"
DATA_DIR="$STACK" bash "$REPO/deploy/standalone/install.sh" $FLAG
echo "อัปเดตเสร็จ"
