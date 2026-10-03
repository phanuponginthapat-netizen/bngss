#!/usr/bin/env bash
# ย้ายข้อมูลจาก Cloud มาเครื่องในโรงเรียน (รันครั้งเดียว ตอนมีเน็ต)
#   sudo CLOUD_DB_URL=postgresql://... CLOUD_URL=https://xxx.supabase.co CLOUD_SERVICE_KEY=... \
#        bash deploy/standalone/migrate-from-cloud.sh
set -euo pipefail
. /etc/school-stack.env 2>/dev/null || true; STACK="${STACK:-/opt/school-stack}"
: "${CLOUD_DB_URL:?ต้องตั้ง CLOUD_DB_URL}"
cd "$STACK/supabase"; set -a; . ./.env; set +a
LOCAL="http://localhost:8000"
/usr/local/bin/school-backup || true

echo "1) ฐานข้อมูล (ผู้ใช้ + ข้อมูลทั้งหมด)"
pg_dump "$CLOUD_DB_URL" -Fc --no-owner -n public -f /tmp/cloud-public.dump
pg_dump "$CLOUD_DB_URL" --data-only -t auth.users -t auth.identities -f /tmp/cloud-auth.sql
docker compose exec -T db psql -U postgres -d postgres -c "TRUNCATE auth.users CASCADE" || true
docker compose exec -T db psql -U postgres -d postgres < /tmp/cloud-auth.sql || true
docker compose exec -T db pg_restore -U postgres -d postgres --clean --if-exists --no-owner -n public < /tmp/cloud-public.dump || true

if [ -n "${CLOUD_URL:-}" ] && [ -n "${CLOUD_SERVICE_KEY:-}" ]; then
  echo "2) ไฟล์ใน Storage"
  for b in $(curl -s "$CLOUD_URL/storage/v1/bucket" -H "Authorization: Bearer $CLOUD_SERVICE_KEY" | grep -oP '"id":"\K[^"]+'); do
    pub=$(curl -s "$CLOUD_URL/storage/v1/bucket/$b" -H "Authorization: Bearer $CLOUD_SERVICE_KEY" | grep -o '"public":true' >/dev/null && echo true || echo false)
    curl -s -X POST "$LOCAL/storage/v1/bucket" -H "Authorization: Bearer $SERVICE_ROLE_KEY" -H "apikey: $ANON_KEY" \
      -H "Content-Type: application/json" -d "{\"id\":\"$b\",\"name\":\"$b\",\"public\":$pub}" >/dev/null || true
    psql "$CLOUD_DB_URL" -Atc "select name from storage.objects where bucket_id='$b'" | while read -r obj; do
      [ -z "$obj" ] && continue
      curl -sf "$CLOUD_URL/storage/v1/object/$b/$obj" -H "Authorization: Bearer $CLOUD_SERVICE_KEY" -o /tmp/obj.bin || continue
      curl -s -X POST "$LOCAL/storage/v1/object/$b/$obj" -H "Authorization: Bearer $SERVICE_ROLE_KEY" -H "apikey: $ANON_KEY" \
        -H "x-upsert: true" --data-binary @/tmp/obj.bin >/dev/null
    done
    echo "   - $b เสร็จ"
  done
fi
echo "3) ไฟล์ที่เคยย้ายขึ้น Google Drive: เปิดหน้า 'คลังข้อมูล' แล้วกด 'ดึงกลับจาก Drive' ขณะมีเน็ต (ทำครั้งเดียว)"
echo "ย้ายข้อมูลเสร็จ"
