#!/usr/bin/env bash
# Build extension zips → public/extension.zip (+ aliases ที่หน้าเว็บ/kiosk ใช้)
# ใช้ก่อน deploy หรือทุกครั้งที่แก้ไฟล์ใน extension/
set -e
cd "$(dirname "$0")/.."
# CI (GitHub Actions) ไม่มี node_modules → คงไฟล์ที่บันทึกไว้ใน extension/ ไว้ตามเดิม
if [ -f node_modules/sweetalert2/dist/sweetalert2.all.min.js ]; then
  cp node_modules/sweetalert2/dist/sweetalert2.all.min.js extension/sweetalert2.all.min.js
fi
test -f extension/sweetalert2.all.min.js || { echo " ขาด extension/sweetalert2.all.min.js"; exit 1; }

OUT="public/extension.zip"
ALIASES=("public/safe-browser-extension.zip" "public/school-safe-browser.zip")

# _metadata/* ถูก Chrome สงวนไว้ (ชื่อขึ้นต้นด้วย "_") → ถ้าติดไปใน zip จะโหลด extension ไม่ได้
EXCLUDES=("_metadata/*" ".DS_Store" "*/.DS_Store" "*.crx" "*.pem")

rm -f "$OUT" "${ALIASES[@]}"

if command -v zip >/dev/null 2>&1; then
  (cd extension && zip -r "../$OUT" . -x "${EXCLUDES[@]}")
else
  (cd extension && nix run nixpkgs#zip -- -r "../$OUT" . -x "${EXCLUDES[@]}")
fi

for a in "${ALIASES[@]}"; do cp "$OUT" "$a"; done

echo "✓ Built $OUT ($(du -h "$OUT" | cut -f1)) + ${#ALIASES[@]} aliases"
