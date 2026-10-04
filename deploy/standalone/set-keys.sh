#!/usr/bin/env bash
# ใส่/แก้กุญแจบริการภายนอก (LINE, AI, Google) ลงฐานข้อมูลบนเครื่องนี้ (HDD)
#   sudo school-set-keys                 # ถามทีละค่า (Enter = ข้าม)
#   sudo school-set-keys /path/keys.env  # อ่านจากไฟล์ KEY=VALUE
# กุญแจใช้เฉพาะตอน "ต่อเน็ต" ไปหาบริการนั้น — ข้อมูลและไฟล์ทั้งหมดยังเก็บบน HDD
set -euo pipefail
. /etc/school-stack.env 2>/dev/null || true; STACK="${STACK:-/opt/school-stack}"
KEYS_FILE="$STACK/keys.env"
KNOWN="LINE_CHANNEL_ACCESS_TOKEN LINE_CHANNEL_SECRET GEMINI_API_KEY OPENAI_API_KEY OPENROUTER_API_KEY GROQ_API_KEY DEEPSEEK_API_KEY GOOGLE_OAUTH_CLIENT_ID GOOGLE_OAUTH_CLIENT_SECRET GOOGLE_DRIVE_REFRESH_TOKEN GOOGLE_CHAT_DEFAULT_WEBHOOK FB_PAGE_ACCESS_TOKEN FB_PAGE_ID"
touch "$KEYS_FILE"; chmod 600 "$KEYS_FILE"

setkv(){ local k="$1" v="$2"; grep -v "^$k=" "$KEYS_FILE" > "$KEYS_FILE.tmp" || true; echo "$k=$v" >> "$KEYS_FILE.tmp"; mv "$KEYS_FILE.tmp" "$KEYS_FILE"; chmod 600 "$KEYS_FILE"; }

if [ -n "${1:-}" ] && [ -f "$1" ]; then
  while IFS='=' read -r k v; do
    k="$(echo "$k" | tr -d '\r ')"; v="$(echo "${v:-}" | tr -d '\r')"
    [[ "$k" =~ ^[A-Z0-9_]+$ ]] && [ -n "$v" ] && setkv "$k" "$v"
  done < "$1"
elif [ -t 0 ]; then
  echo "ใส่กุญแจที่มี (กด Enter เพื่อข้าม/คงค่าเดิม)"
  for k in $KNOWN; do read -r -p "$k: " v; [ -n "$v" ] && setkv "$k" "$v"; done
fi

# เขียนลงตาราง app_secrets ในฐานข้อมูลบนเครื่อง (ระบบอ่านค่าจากตรงนี้ก่อนเสมอ)
DC="docker compose -f $STACK/supabase/docker-compose.yml"
while IFS='=' read -r k v; do
  [[ "$k" =~ ^[A-Z0-9_]+$ ]] || continue
  vq="${v//\'/\'\'}"
  echo "INSERT INTO public.app_secrets(key,value,category) VALUES ('$k','$vq','standalone') ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=now();"
done < "$KEYS_FILE" | $DC exec -T db psql -q -U postgres -d postgres >/dev/null
# ให้ functions เห็นค่าใหม่ทันที (รองรับฟังก์ชันที่อ่านจาก env)
$DC up -d functions >/dev/null 2>&1 || true
echo "บันทึกกุญแจแล้ว ($(grep -c = "$KEYS_FILE") รายการ) — แก้ภายหลังได้ที่เมนู ตั้งค่า > API Keys ในระบบ"
