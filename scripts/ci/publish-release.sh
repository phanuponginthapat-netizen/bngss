#!/usr/bin/env bash
# เผยแพร่ไฟล์ติดตั้งขึ้น GitHub Releases แบบ "รุ่นล่าสุดชุดเดียวต่อโปรแกรม"
#   - ลบ release/tag เดิมของโปรแกรมนี้ (รวม tag เวอร์ชันเก่า v*) แล้วสร้างใหม่ด้วยไฟล์ล่าสุด
#   - เขียน release-<product>.json ขึ้น app-downloads ให้หน้าเว็บอ่านลิงก์ดาวน์โหลด
# ใช้: publish-release.sh <product> <title> <version> <file>...
# ต้องมี env: GH_TOKEN, GITHUB_REPOSITORY  (SUPABASE_ANON_KEY ถ้ามีจะอัปโหลด manifest)
set -euo pipefail
PRODUCT="$1"; TITLE="$2"; VERSION="$3"; shift 3
TAG="${PRODUCT}-latest"

# ลบ release เก่าของโปรแกรมนี้ทั้งหมด (tag ล่าสุดเดิม + tag แปะเวอร์ชันแบบเก่า)
gh release list --limit 200 --json tagName -q '.[].tagName' | while read -r t; do
  case "$t" in
    "$TAG"|"${PRODUCT}-v"*) gh release delete "$t" --yes --cleanup-tag || true ;;
  esac
  # release รุ่นเก่าจากงาน APK เดิม (v<เวอร์ชัน>-<build>) ลบเมื่อเผยแพร่ android
  if [ "$PRODUCT" = "android" ] && [[ "$t" =~ ^v[0-9] ]]; then
    gh release delete "$t" --yes --cleanup-tag || true
  fi
done
git push origin ":refs/tags/$TAG" 2>/dev/null || true

gh release create "$TAG" "$@" --title "$TITLE ($VERSION)" \
  --notes "รุ่นล่าสุด $VERSION — สร้างอัตโนมัติจาก ${GITHUB_SHA:-local}" --target "${GITHUB_SHA:-main}"

if [ -n "${CI_UPLOAD_TOKEN:-}" ]; then
  python3 - "$PRODUCT" "$TITLE" "$VERSION" "$GITHUB_REPOSITORY" "$TAG" "$@" > /tmp/release-$PRODUCT.json <<'PY'
import json, os, sys, datetime
product, title, version, repo, tag, *files = sys.argv[1:]
identity = {}
if product == "scanner":
  with open(os.environ["SCANNER_IDENTITY_FILE"]) as f:
    identity = json.load(f)
  if identity.get("appId") != "com.bngss.scanner" or identity.get("appName") != "BNG Scanner" or identity.get("identityVerified") is not True:
    raise SystemExit("Scanner APK identity has not been verified")
print(json.dumps({
  **identity,
  "product": product, "title": title, "version": version,
  "releasedAt": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
  "pageUrl": f"https://github.com/{repo}/releases/tag/{tag}",
  "files": [{"name": os.path.basename(f), "sizeBytes": os.path.getsize(f),
             "url": f"https://github.com/{repo}/releases/download/{tag}/{os.path.basename(f)}"} for f in files],
}, ensure_ascii=False))
PY
  source "$(dirname "$0")/storage.sh"
  ci_upload "/tmp/release-$PRODUCT.json" application/json "release-$PRODUCT.json"
fi
