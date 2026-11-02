#!/usr/bin/env bash
# Shared helper: upload to the private app-downloads bucket through the ci-storage function.
# Requires env CI_UPLOAD_TOKEN. Usage: source scripts/ci/storage.sh; ci_upload <file> <content-type> <target>
CI_STORAGE_URL="${SUPABASE_URL:-https://dlkyxvhnnffblerwedjz.supabase.co}"
CI_STORAGE_URL="${CI_STORAGE_URL%/}"

ci_upload() {
  local path="$1" ctype="$2" target="$3" sign url code body
  if [ -z "${CI_UPLOAD_TOKEN:-}" ]; then echo "::error::CI_UPLOAD_TOKEN secret is missing"; return 1; fi
  sign="$(curl -sS --fail-with-body -X POST -H "x-ci-token: $CI_UPLOAD_TOKEN" -H "Content-Type: application/json" \
    --data "{\"action\":\"sign_upload\",\"path\":\"${target}\"}" "${CI_STORAGE_URL}/functions/v1/ci-storage")" || { echo "sign ${target} failed: $sign"; return 1; }
  url="$(printf '%s' "$sign" | python3 -c 'import json,sys;print(json.load(sys.stdin)["signedUrl"])')" || return 1
  case "$url" in http*) ;; *) url="${CI_STORAGE_URL}/storage/v1${url}" ;; esac
  body="$(mktemp)"
  code="$(curl -sS -o "$body" -w "%{http_code}" -X PUT -H "Content-Type: $ctype" -H "x-upsert: true" --data-binary "@${path}" "$url")"
  echo "upload ${target} -> HTTP ${code}: $(cat "$body")"
  [ "$code" = "200" ]
}
