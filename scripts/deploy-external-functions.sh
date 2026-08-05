#!/usr/bin/env bash
# Deploy all Edge Functions + database secrets to the school's own Supabase project.
#
# Usage:
#   export SUPABASE_ACCESS_TOKEN=sbp_xxx      # personal access token from the target account
#   export TARGET_PROJECT_REF=gwmszzoqqxmejefhayqf
#   ./scripts/deploy-external-functions.sh
#
# Requires the Supabase CLI (https://supabase.com/docs/guides/cli).
set -euo pipefail

: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN is required}"
: "${TARGET_PROJECT_REF:?TARGET_PROJECT_REF is required}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Deploying Edge Functions to $TARGET_PROJECT_REF"
for dir in supabase/functions/*/; do
  name="$(basename "$dir")"
  # _shared is a library folder, migrate-auth-push is a one-time migration helper
  case "$name" in _shared|migrate-auth-push) continue ;; esac
  echo "--> $name"
  supabase functions deploy "$name" \
    --project-ref "$TARGET_PROJECT_REF" \
    --no-verify-jwt
done

echo "==> Done. Next: set function secrets with"
echo "    supabase secrets set --project-ref $TARGET_PROJECT_REF --env-file .env.functions"
