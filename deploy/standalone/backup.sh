#!/usr/bin/env bash
# สำรองฐานข้อมูล + ไฟล์ทุกคืน เก็บ 14 ชุดล่าสุด; แบบผสมจะส่งขึ้น Cloud ด้วย (ถ้ามีเน็ต)
set -euo pipefail
STACK=/opt/school-stack; . "$STACK/backup.env" 2>/dev/null || true
DEST="${BACKUP_DIR:-$STACK/backups}"; mkdir -p "$DEST"
TS=$(date +%Y%m%d-%H%M)
cd "$STACK/supabase"
docker compose exec -T db pg_dump -U postgres -Fc postgres > "$DEST/db-$TS.dump"
tar -czf "$DEST/storage-$TS.tgz" -C volumes storage 2>/dev/null || true
ls -1t "$DEST"/db-*.dump | tail -n +15 | xargs -r rm -f
ls -1t "$DEST"/storage-*.tgz | tail -n +15 | xargs -r rm -f
# สำเนาลง External HDD ถ้าเสียบอยู่
[ -d /media/backup ] && cp "$DEST/db-$TS.dump" /media/backup/ || true
# แบบผสม: ส่งขึ้น Cloud database (ตั้ง CLOUD_DB_URL ใน backup.env)
if [ "${MODE:-}" = "hybrid" ] && [ -n "${CLOUD_DB_URL:-}" ] && curl -sf -m 5 https://www.google.com >/dev/null; then
  pg_restore --clean --if-exists --no-owner -d "$CLOUD_DB_URL" -n public "$DEST/db-$TS.dump" || echo "sync cloud ล้มเหลว จะลองใหม่คืนถัดไป"
fi
echo "[$TS] backup OK"
