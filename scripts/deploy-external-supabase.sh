#!/usr/bin/env bash
# Deploy this project's schema, edge functions, and storage buckets to an
# EXTERNAL Supabase Cloud project (or any self-hosted Supabase instance).
#
# Prerequisites (run once on your machine):
#   1. Install Supabase CLI: https://supabase.com/docs/guides/cli
#        brew install supabase/tap/supabase       # macOS
#        scoop bucket add supabase ... ; scoop install supabase  # Windows
#   2. `supabase login` (Cloud only — skip for self-host)
#   3. Get your target project's:
#        - PROJECT_REF   (e.g. uhbabufmdozwiivsjhpr)
#        - DB_PASSWORD   (Project Settings → Database)
#        - SUPABASE_URL  (https://<ref>.supabase.co  OR  https://supabase.mydomain.com)
#        - SERVICE_ROLE_KEY (Project Settings → API)
#
# Usage:
#   PROJECT_REF=xxxx DB_PASSWORD='...' SUPABASE_URL='https://xxxx.supabase.co' \
#   SERVICE_ROLE_KEY='eyJ...' ./scripts/deploy-external-supabase.sh
#
set -euo pipefail

: "${PROJECT_REF:?PROJECT_REF is required}"
: "${DB_PASSWORD:?DB_PASSWORD is required}"
: "${SUPABASE_URL:?SUPABASE_URL is required}"
: "${SERVICE_ROLE_KEY:?SERVICE_ROLE_KEY is required}"

echo "==> Linking project $PROJECT_REF"
supabase link --project-ref "$PROJECT_REF" --password "$DB_PASSWORD"

echo "==> Pushing 442 migrations from supabase/migrations/"
supabase db push --password "$DB_PASSWORD"

echo "==> Creating storage buckets"
# Public buckets
for b in cms-images garbage-images profile-images; do
  supabase storage create "$b" --public || true
done
# Private buckets
for b in ai-import-temp asset-photos attendance-photos cold-archive \
         document-files eform-attachments exam-scans face-photos \
         home-visit-photos homework-files hub-projects ict-loan-photos \
         leave-attachments pa-files portfolio pp5-files pp6-files \
         substitute-proof wall-media; do
  supabase storage create "$b" || true
done

echo "==> Deploying edge functions"
FUNCTIONS=(
  ai-chat ai-import-analyze ai-import-execute ai-import-test-scores
  analyze-data analyze-pdf-template announce-pp5-scores announce-pp6-scores
  assess-bmi attendance-daily-report auto-pull-bundle backup-data
  backup-snapshot backup-to-external bootstrap-admin calendar-ics
  check-upcoming-events cleanup-orphan-storage code-login create-admin-user
  daily-line-digest district-feed-api district-feed-create-key
  district-nightly-snapshot exam-generate exam-grade ext-config ext-log
  face-scan-daily-report face-scan-summary fill-pdf-template games-auth
  games-leaderboard games-submit gchat-summary get-vapid-key
  import-teacher-schedule iot-fetch liff-submit-leave line-magic-link
  line-quota line-webhook link-account lookup-email manage-users manifest
  mascot-advice mcp notify-fanout notify-google-chat notify-ict-overdue
  notify-line notify-retry parent-login parse-curriculum-pdf qr-login
  refresh-mascot-advice-weekly seed-test-users send-push send-push-broadcast
  setup-line-richmenu social-feed-sync suggest-proxy-mapping system-backup
  system-update translate-text tts-elevenlabs tts-th upload-line-richmenu
)
for fn in "${FUNCTIONS[@]}"; do
  echo "  - deploying $fn"
  supabase functions deploy "$fn" --no-verify-jwt --project-ref "$PROJECT_REF" || echo "    (failed, continue)"
done

echo ""
echo "==> DONE. Next steps:"
echo "  1. Set edge-function secrets:  supabase secrets set --env-file .env.functions"
echo "     (see scripts/EXTERNAL_SUPABASE_SETUP.md for the full list)"
echo "  2. Configure Auth → URL Configuration → add your app URL to redirect URLs"
echo "  3. Update the frontend .env with the new URL + anon key and rebuild"
