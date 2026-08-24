#!/usr/bin/env bash
# ============================================================
#  Smart School — อัปเดต Plymouth boot splash จาก CMS
#  ใช้เมื่อเปลี่ยนโลโก้/ชื่อโรงเรียนใน CMS แล้วอยากให้จอบูตเปลี่ยนตาม
#  โดยไม่ต้องรันสคริปต์ติดตั้ง kiosk ใหม่ทั้งชุด
#
#  วิธีใช้:  sudo bash update-boot-splash.sh
# ============================================================
set -uo pipefail

[[ $EUID -eq 0 ]] || { echo "ต้องรันด้วย sudo"; exit 1; }

log() { echo -e "$*"; }
have() { command -v "$1" >/dev/null 2>&1; }

KIOSK_ORIGIN="${KIOSK_ORIGIN:-https://bngss.lovable.app}"
CMS_SUPABASE_URL="${CMS_SUPABASE_URL:-https://dlkyxvhnnffblerwedjz.supabase.co}"
CMS_SUPABASE_ANON="${CMS_SUPABASE_ANON:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsa3l4dmhubmZmYmxlcndlZGp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzNjY5MTIsImV4cCI6MjA5OTk0MjkxMn0.bQqqX3veJ_pGr9fSa0a-bKIS-w7UmR569a2xDZQ6Cx4}"

log "▶ ดึง branding จาก CMS ..."
CMS_JSON=$(curl -sf --max-time 10 "$CMS_SUPABASE_URL/functions/v1/ext-config" \
  -H "apikey: $CMS_SUPABASE_ANON" -H "Authorization: Bearer $CMS_SUPABASE_ANON" 2>/dev/null || echo '{}')

if [[ "$(echo -n "$CMS_JSON" | wc -c)" -lt 20 ]]; then
  _rows=$(curl -sf --max-time 10 \
    "$CMS_SUPABASE_URL/rest/v1/cms_settings?select=key,value&key=in.(school_name,app_name,school_logo,school_logo_512,app_favicon_url,theme_color,primary_color)" \
    -H "apikey: $CMS_SUPABASE_ANON" -H "Authorization: Bearer $CMS_SUPABASE_ANON" 2>/dev/null || echo '[]')
  CMS_JSON=$(python3 -c "import sys,json
rows=json.loads(sys.stdin.read() or '[]')
print(json.dumps({r['key']: r.get('value') or '' for r in rows if r.get('key')}))" <<<"$_rows" 2>/dev/null || echo '{}')
  log "   ใช้ REST fallback"
fi

extract_json() {
  python3 -c "import sys,json;d=json.loads(sys.stdin.read() or '{}');print(d.get('$1','') or '')" <<<"$CMS_JSON" 2>/dev/null || echo ""
}

CMS_NAME=$(extract_json school_name)
[[ -z "$CMS_NAME" ]] && CMS_NAME=$(extract_json app_name)
[[ ${#CMS_NAME} -lt 3 ]] && CMS_NAME="BNG Smart School"
CMS_LOGO_URL=$(extract_json school_logo)
CMS_LOGO_512=$(extract_json school_logo_512)
CMS_FAVICON=$(extract_json app_favicon_url)
CMS_COLOR=$(extract_json theme_color)
[[ -z "$CMS_COLOR" ]] && CMS_COLOR=$(extract_json primary_color)
[[ "$CMS_COLOR" =~ ^#[0-9A-Fa-f]{6}$ ]] || CMS_COLOR="#2563EB"

log "   ชื่อ:   $CMS_NAME"
log "   โลโก้:  ${CMS_LOGO_URL:-<ไม่มี>}"
log "   สี:     $CMS_COLOR"

hex_to_rgb_floats() {
  local h=${1#\#}
  local r=$((16#${h:0:2})) g=$((16#${h:2:2})) b=$((16#${h:4:2}))
  awk -v r=$r -v g=$g -v b=$b 'BEGIN{printf "%.4f %.4f %.4f", r/255, g/255, b/255}'
}
read -r PLY_R PLY_G PLY_B <<<"$(hex_to_rgb_floats "$CMS_COLOR")"

apt-get install -y --no-install-recommends plymouth plymouth-themes plymouth-label imagemagick initramfs-tools fonts-thai-tlwg 2>/dev/null || true

THEME_DIR=/usr/share/plymouth/themes/smartschool
install -d -m 755 "$THEME_DIR"

LOGO_PATH="$THEME_DIR/logo.png"
rm -f "$LOGO_PATH" "$LOGO_PATH.src"
for _lu in "$CMS_LOGO_URL" "$CMS_LOGO_512" "$CMS_FAVICON" "${KIOSK_ORIGIN%/}/icon-512.png" "${KIOSK_ORIGIN%/}/icon-192.png"; do
  [[ -z "$_lu" ]] && continue
  rm -f "$LOGO_PATH.src"
  curl -sfL --max-time 20 "$_lu" -o "$LOGO_PATH.src" || continue
  [[ -s "$LOGO_PATH.src" ]] || continue
  have convert && convert "$LOGO_PATH.src" -auto-orient -resize '320x320>' -background none \
    -gravity center -extent 320x320 PNG32:"$LOGO_PATH" 2>/dev/null || true
  if [[ -s "$LOGO_PATH" ]]; then log "   ✓ โลโก้ boot: $_lu"; break; fi
done
rm -f "$LOGO_PATH.src"

if [[ ! -s "$LOGO_PATH" ]] && have convert; then
  log "   ⚠ ใช้โลโก้ตัวอักษรแทน"
  convert -size 320x320 xc:none -gravity center -fill white -pointsize 96 -font DejaVu-Sans-Bold \
    -annotate 0 "$(printf '%s' "$CMS_NAME" | cut -c1-2)" PNG32:"$LOGO_PATH" 2>/dev/null || true
fi
[[ -s "$LOGO_PATH" ]] || printf '%s' 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=' | base64 -d >"$LOGO_PATH"

fc-cache -f 2>/dev/null || true
THAI_FONT_FILE=""
if have fc-match; then
  for q in "Noto Sans Thai:style=Bold" "Loma:style=Bold" "Norasi:style=Bold" "Noto Sans Thai" "Loma" "Waree"; do
    f=$(fc-match -f '%{file}\n' "$q" 2>/dev/null || true)
    [[ -n "$f" && -f "$f" ]] && { THAI_FONT_FILE="$f"; break; }
  done
fi
[[ -z "$THAI_FONT_FILE" ]] && THAI_FONT_FILE="$(ls /usr/share/fonts/truetype/tlwg/*.ttf 2>/dev/null | head -1)"

make_text_png() {
  local text="$1" out="$2" size="${3:-36}" width="${4:-900}" height="${5:-90}"
  rm -f "$out"
  if have convert; then
    [[ -n "$THAI_FONT_FILE" ]] && convert -background none -fill white -gravity center \
      -size "${width}x${height}" -font "$THAI_FONT_FILE" -pointsize "$size" "caption:${text}" PNG32:"$out" 2>/dev/null || true
    [[ -s "$out" ]] || convert -background none -fill white -gravity center -size "${width}x${height}" \
      -pointsize "$size" "caption:${text}" PNG32:"$out" 2>/dev/null || true
  fi
  [[ -s "$out" ]] || printf '%s' 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=' | base64 -d >"$out"
}
make_text_png "$CMS_NAME" "$THEME_DIR/title.png" 38 1000 110
make_text_png "กำลังเริ่มต้นระบบ..." "$THEME_DIR/status.png" 24 700 60

cat >"$THEME_DIR/smartschool.plymouth" <<EOF
[Plymouth Theme]
Name=Smart School
Description=CMS themed boot splash
ModuleName=script

[script]
ImageDir=$THEME_DIR
ScriptFile=$THEME_DIR/smartschool.script
EOF

cat >"$THEME_DIR/smartschool.script" <<PLY
Window.SetBackgroundTopColor($PLY_R, $PLY_G, $PLY_B);
Window.SetBackgroundBottomColor($PLY_R, $PLY_G, $PLY_B);

logo.image = Image("logo.png");
logo.sprite = Sprite(logo.image);
logo.sprite.SetX(Window.GetWidth() / 2 - logo.image.GetWidth() / 2);
logo.sprite.SetY(Window.GetHeight() / 2 - logo.image.GetHeight() / 2 - 70);

title.image = Image("title.png");
title.sprite = Sprite(title.image);
title.sprite.SetX(Window.GetWidth() / 2 - title.image.GetWidth() / 2);
title.sprite.SetY(Window.GetHeight() / 2 + 100);

status.image = Image("status.png");
status.sprite = Sprite(status.image);
status.sprite.SetX(Window.GetWidth() / 2 - status.image.GetWidth() / 2);
status.sprite.SetY(Window.GetHeight() - 80);
PLY

install -d -m 755 /etc/plymouth
cat >/etc/plymouth/plymouthd.conf <<EOF
[Daemon]
Theme=smartschool
ShowDelay=0
DeviceTimeout=8
EOF

log "▶ ตั้ง theme + rebuild initramfs ..."
if have plymouth-set-default-theme; then
  plymouth-set-default-theme -R smartschool 2>&1 | tail -5 || plymouth-set-default-theme smartschool 2>&1 | tail -3 || true
elif [[ -x /usr/sbin/plymouth-set-default-theme ]]; then
  /usr/sbin/plymouth-set-default-theme -R smartschool 2>&1 | tail -5 || true
fi
update-initramfs -u 2>&1 | tail -5 || true

log "✅ อัปเดต boot splash แล้ว — theme ปัจจุบัน: $(plymouth-set-default-theme 2>/dev/null || echo unknown)"
log "   รีบูตเครื่องเพื่อดูผลลัพธ์"
