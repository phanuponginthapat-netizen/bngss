#!/usr/bin/env bash
# Build extension.zip → public/extension.zip
# ใช้ก่อน deploy หรือทุกครั้งที่แก้ไฟล์ใน extension/
set -e
cd "$(dirname "$0")/.."
rm -f public/extension.zip
if command -v zip >/dev/null 2>&1; then
  (cd extension && zip -r ../public/extension.zip .)
else
  (cd extension && nix run nixpkgs#zip -- -r ../public/extension.zip .)
fi
echo "✓ Built public/extension.zip ($(du -h public/extension.zip | cut -f1))"
