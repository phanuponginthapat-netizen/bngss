#!/usr/bin/env bash
# อัปเดตระบบเป็นรุ่นล่าสุด (สำรองก่อนทุกครั้ง): sudo school-update
set -euo pipefail
. /etc/school-stack.env 2>/dev/null || true; STACK="${STACK:-/opt/school-stack}"
REPO="$(cat "$STACK/repo-path")"
/usr/local/bin/school-backup
cd "$REPO" && git pull --ff-only
MODE=$(grep -oP '(?<=MODE=)\w+' "$STACK/backup.env" || echo standalone)
FLAG=""; [ "$MODE" = "hybrid" ] && FLAG="--hybrid"
DATA_DIR="$STACK" bash "$REPO/deploy/standalone/install.sh" $FLAG
echo "อัปเดตเสร็จ"
