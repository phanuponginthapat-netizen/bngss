#!/usr/bin/env bash
# รวม migration ทั้งหมดเป็นไฟล์ SQL เดียว สำหรับติดตั้งระบบบน Supabase ใหม่ (portable deploy)
#
#   bash scripts/build-migration-bundle.sh            -> dist/bundle/schema-bundle.sql
#   psql "$DATABASE_URL" -f dist/bundle/schema-bundle.sql
#
# migration ทุกไฟล์ถูกทำให้ idempotent แล้ว (IF NOT EXISTS / DROP POLICY IF EXISTS)
# จึงรันซ้ำได้อย่างปลอดภัย
set -euo pipefail

SRC_DIR="supabase/migrations"
OUT_DIR="dist/bundle"
OUT="$OUT_DIR/schema-bundle.sql"
PLACEHOLDER_UUID_RE='(11111111-1111-1111-1111-111111111111|22222222-2222-2222-2222-222222222222|33333333-3333-3333-3333-333333333333|aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa|bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb|cccccccc-cccc-cccc-cccc-cccccccccccc|dddddddd-dddd-dddd-dddd-dddddddddddd|eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee|ffffffff-ffff-ffff-ffff-ffffffffffff)'

[ -d "$SRC_DIR" ] || { echo "ไม่พบโฟลเดอร์ $SRC_DIR"; exit 1; }
mkdir -p "$OUT_DIR"

# Block demo IDs that could violate foreign keys in a fresh installation.
# SQL comments are excluded so historical explanations remain allowed.
unsafe_placeholder_lines="$(grep -RInE --include='*.sql' "$PLACEHOLDER_UUID_RE" "$SRC_DIR" | grep -vE '^[^:]+:[0-9]+:[[:space:]]*--' || true)"
if [ -n "$unsafe_placeholder_lines" ]; then
  echo "พบ placeholder UUID ที่อาจทำให้ foreign key ล้มเหลว:" >&2
  echo "$unsafe_placeholder_lines" >&2
  exit 1
fi

{
  echo "-- =============================================================="
  echo "-- School System — schema bundle"
  echo "-- generated: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
  echo "-- =============================================================="
  echo "SET statement_timeout = 0;"
  echo "SET lock_timeout = '5s';"
  echo "SET idle_in_transaction_session_timeout = '60s';"
  echo "SET client_min_messages = warning;"
  echo
} > "$OUT"

count=0
for f in $(ls -1 "$SRC_DIR"/*.sql | sort); do
  {
    echo
    echo "-- ---------- $(basename "$f") ----------"
    cat "$f"
    echo
  } >> "$OUT"
  count=$((count + 1))
done

echo "รวม $count ไฟล์ -> $OUT ($(wc -c < "$OUT" | tr -d ' ') bytes)"
