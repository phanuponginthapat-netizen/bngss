#!/usr/bin/env bash
# =====================================================================
#  สร้างไฟลด์าวนห์ลอดของโปรแกรมตู้สแกน FaceGate (Windows + Linux)
#
#  ผลลพัธ ์:
#    public/downloads/facegate-agent-installer.zip   ← ไฟลท์ี่หน ้าเว็บอ ้างถ ึง (ล ้างส ุดเสมอ)
#    $BUILD_DIR/facegate-agent-latest.zip            ← สำเนาสำหรับเข ้าพ ื้นท ี่เก ็บของโรงเร ียน
#    $BUILD_DIR/facegate-agent-v<ver>-<build>.zip    ← สำเนาแปะเวอร ์ช ัน (ก ันไฟล ์ท ับก ันตอนดาวนห์ ลอด)
#    $BUILD_DIR/facegate-version.json                ← manifest ให ้หน ้าเว็บ + ต ู้สแกนตรวจร ุ่ นใหม ่
#
#  ก ่อนแพ็กจะตรวจ 2 อย ่างก ่อนเสมอ (ก ันบ ัคท ี่เคยเก ิดข ึ้ นแล ้ว)
#    1. ไฟล ์ .py ท ุกต ัวต ้องคอมไพล ์ผ ่าน (ไกร ์แม ้ผ ิดต ัวได ้)
#    2. โมด ูลท ี่ agent.py ต ้องการต ้องอย ู่ใน zip ครบ (โมด ูลใหม ่ถ ูกลืมแพ็กไม ่ได ้)
#
#  ใช ้:  bash scripts/kiosk/package-facegate.sh
#  ต ัวแปรต ั้งค ่า:
#    FACEGATE_SITE_URL      ปลายทางท ี่โปรแกรมต ่อเข ้าถ ึง (default https://bngss.lovable.app)
#    FACEGATE_DOWNLOAD_URL  ลิงก ์ท ี่ manifest ช ี้ไป (default <site>/downloads/...zip)
#    FACEGATE_BUILD_DIR     โฟลเดอร ์ช ั่วคราว (default /tmp/facegate-build)
#    FACEGATE_OUT_DIR       โฟลเดอร ์ผลลัพธ์ (default public/downloads)
# =====================================================================
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$HERE/facegate-agent"
OUT_DIR="${FACEGATE_OUT_DIR:-$HERE/../../public/downloads}"
BUILD_DIR="${FACEGATE_BUILD_DIR:-/tmp/facegate-build}"
SITE_URL="${FACEGATE_SITE_URL:-https://bngss.lovable.app}"
DOWNLOAD_URL="${FACEGATE_DOWNLOAD_URL:-$SITE_URL/downloads/facegate-agent-installer.zip}"
BUILD_NO="${GITHUB_RUN_NUMBER:-$(date -u +%Y%m%d%H%M)}"

[ -d "$SRC" ] || { echo "ไมพ ่ บโฟลเดอร ์โปรแกรม: $SRC" >&2; exit 1; }
mkdir -p "$BUILD_DIR" "$OUT_DIR"
STAGE="$BUILD_DIR/stage"
rm -rf "$STAGE"; mkdir -p "$STAGE/facegate-agent"

VERSION="$(sed -n 's/^AGENT_VERSION = "\([^"]*\)".*/\1/p' "$SRC/agent.py" | head -1)"
[ -n "$VERSION" ] || { echo "อ ่าน AGENT_VERSION จาก agent.py ไม ่ได ้" >&2; exit 1; }

# ---------- 1) ไฟล ์ต ัวโปรแกรม (ไม ่เอาไฟล ์ท ี่เก ิดข ึ้ นตอนร ัน) ----------
copy_file() {
  local f="$1"
  case "$f" in
    *.py|*.txt|*.md|*.sh|*.bat|*.ps1) ;;
    *) return 0 ;;
  esac
  local tmp="$STAGE/facegate-agent/$(basename "$f")"
  cp "$f" "$tmp"
  # ต ัวต ัดท ี่มาก ับ zip/Windows ใช ้งานบน Linux ไม ่ได ้
  sed -i -e 's/\r$//' -e "s|__CLOUD_URL__|$SITE_URL|g" "$tmp"
  case "$f" in
    *install.sh) chmod +x "$tmp" ;;
  esac
}
while IFS= read -r -d '' f; do
  copy_file "$f"
done < <(find "$SRC" -maxdepth 1 -type f -print0)

# ---------- 2) ตรวจส ันแทกซ ์----------
python3 - "$STAGE/facegate-agent" <<'PY'
import compileall, sys
root = sys.argv[1]
if not compileall.compile_dir(root, quiet=1, force=True):
    print("ไฟล ์ .py มีต ัวคอมไพล ์ผ ิด — ไม ่แพ็ก", file=sys.stderr)
    sys.exit(1)
print(f"[facegate] คอมไพล ์ .py ผ ่านท ุกต ัว")
PY

# ---------- 3) ตรวจว ่ าโมด ูลท ี่ต ้องการต ้องอย ู่ใน zip ครบ ----------
python3 - "$STAGE/facegate-agent" <<'PY'
import ast, os, sys
root = sys.argv[1]
have = {os.path.splitext(f)[0] for f in os.listdir(root) if f.endswith(".py")}
need = set()
for f in sorted(have):
    try:
        tree = ast.parse(open(os.path.join(root, f + ".py"), encoding="utf-8").read())
    except SyntaxError as exc:
        print(f"{f}.py ไกร ์แม ้ผ ิด: {exc}", file=sys.stderr); sys.exit(1)
    for node in ast.walk(tree):
        mods = []
        if isinstance(node, ast.Import):
            mods = [n.name.split(".")[0] for n in node.names]
        elif isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
            mods = [node.module.split(".")[0]]
        for m in mods:
            if m in have and m != f:
                need.add(m)
missing = sorted(need - have)
if missing:
    print(f"โมด ูลท ี่โปรแกรมต ้องการหายจากแพ็กเกจ: {', '.join(missing)}", file=sys.stderr)
    sys.exit(1)
print(f"[facegate] โมด ูลครบ {len(have)} ต ัว (ท ี่ agent ต ้องการ: {len(need)})")
PY

# ---------- 4) ห ่อ zip ----------
python3 - "$STAGE" "$BUILD_DIR" "$VERSION" "$BUILD_NO" <<'PY'
import os, sys, zipfile
stage, out, version, build = sys.argv[1:5]
zipsrc = os.path.join(stage, "facegate-agent")
names = sorted(f for f in os.listdir(zipsrc) if os.path.isfile(os.path.join(zipsrc, f)))
target = os.path.join(out, "facegate-agent-installer.zip")
with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as zf:
    zf.writestr("facegate-agent/", "")
    for n in names:
        zf.write(os.path.join(zipsrc, n), f"facegate-agent/{n}")
    print(f"[facegate] แพ็ก {len(names)} ไฟล ์ลง zip")
for suffix in ("facegate-agent-latest.zip", f"facegate-agent-v{version}-{build}.zip"):
    with open(target, "rb") as src, open(os.path.join(out, suffix), "wb") as dst:
        dst.write(src.read())
PY

# ---------- 5) manifest ----------
ZIP="$BUILD_DIR/facegate-agent-installer.zip"
SHA="$(python3 -c 'import hashlib,sys;print(hashlib.sha256(open(sys.argv[1],"rb").read()).hexdigest())' "$ZIP")"
SIZE="$(wc -c < "$ZIP" | tr -d ' ')"
python3 - "$BUILD_DIR/facegate-version.json" "$VERSION" "$BUILD_NO" "$DOWNLOAD_URL" "$SHA" "$SIZE" <<'PY'
import json, sys, datetime
path, version, build, url, sha, size = sys.argv[1:7]
json.dump({
    "version": version,
    "build": int(build) if build.isdigit() else build,
    "fileName": f"facegate-agent-v{version}-{build}.zip",
    "url": url,
    "sha256": sha,
    "sizeBytes": int(size),
    "releasedAt": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "notes": f"โปรแกรมต ู้สแกน FaceGate รุ ່น {version} (build {build})",
}, open(path, "w", encoding="utf-8"), ensure_ascii=False)
PY

# ---------- 6) ให ้หน ้าเว็บดาวนห์ ลอดได ้ท ันที (ล ้างส ุดเสมอ) ----------
cp "$ZIP" "$OUT_DIR/facegate-agent-installer.zip"

echo "[facegate] เสร ็จแล ้ว v$VERSION (build $BUILD_NO) — $((SIZE / 1024)) KB  sha256=${SHA:0:12}…"
ls -1 "$BUILD_DIR" | sed 's/^/  /'
