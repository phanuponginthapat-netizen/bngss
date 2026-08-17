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

[ -d "$SRC_DIR" ] || { echo "ไม่พบโฟลเดอร์ $SRC_DIR"; exit 1; }
mkdir -p "$OUT_DIR"

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
