#!/usr/bin/env bash
# กู้คืนจากไฟล์สำรอง: sudo school-restore [ไฟล์ db-*.dump]  (ไม่ระบุ = ชุดล่าสุด)
set -euo pipefail
. /etc/school-stack.env 2>/dev/null || true; STACK="${STACK:-/opt/school-stack}"
DEST="$STACK/backups"
DUMP="${1:-$(ls -1t "$DEST"/db-*.dump | head -1)}"
[ -f "$DUMP" ] || { echo "ไม่พบไฟล์สำรอง"; exit 1; }
TS=$(basename "$DUMP" .dump | sed 's/^db-//')
read -r -p "กู้คืนจาก $DUMP ? ข้อมูลปัจจุบันจะถูกแทนที่ (yes/no): " a; [ "$a" = "yes" ] || exit 0
cd "$STACK/supabase"
docker compose exec -T db pg_restore -U postgres -d postgres --clean --if-exists --no-owner -n public < "$DUMP" || true
[ -f "$DEST/storage-$TS.tgz" ] && tar -xzf "$DEST/storage-$TS.tgz" -C volumes
docker compose restart
echo "กู้คืนเสร็จ"
