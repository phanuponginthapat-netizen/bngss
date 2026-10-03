#!/usr/bin/env bash
# ติดตั้งระบบโรงเรียนแบบ Standalone (ใช้ใน LAN ไม่ต้องใช้ Cloud)
# รองรับ Ubuntu/Debian/MX Linux และ Windows (ผ่าน WSL2 + Docker Desktop)
#
#   sudo bash deploy/standalone/install.sh            # ติดตั้งใหม่
#   sudo bash deploy/standalone/install.sh --hybrid   # แบบผสม: สำรองขึ้น Cloud เมื่อมีเน็ต
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# เก็บข้อมูลทั้งหมด (ฐานข้อมูล + ไฟล์ + สำรอง) ไว้ที่ DATA_DIR บน HDD
STACK="${DATA_DIR:-/opt/school-stack}"
MODE="standalone"; [ "${1:-}" = "--hybrid" ] && MODE="hybrid"
echo "STACK=$STACK" > /etc/school-stack.env
LAN_IP="${LAN_IP:-$(hostname -I 2>/dev/null | awk '{print $1}')}"
[ -n "$LAN_IP" ] || LAN_IP=127.0.0.1
echo "== ติดตั้งแบบ $MODE ที่ IP $LAN_IP =="

# 1) Docker
if ! command -v docker >/dev/null; then
  echo "-> ติดตั้ง Docker"; curl -fsSL https://get.docker.com | sh
fi
command -v git >/dev/null || apt-get update -y && apt-get install -y git curl openssl postgresql-client nodejs npm >/dev/null || true

# 2) Supabase self-hosted (ฐานข้อมูล + ล็อกอิน + ไฟล์ + functions)
mkdir -p "$STACK"
if [ ! -d "$STACK/supabase" ]; then
  git clone --depth 1 https://github.com/supabase/supabase "$STACK/supabase-src"
  cp -r "$STACK/supabase-src/docker" "$STACK/supabase"
fi
cd "$STACK/supabase"
if [ ! -f .env ]; then
  cp .env.example .env
  JWT=$(openssl rand -hex 32); PG=$(openssl rand -hex 16); DASH=$(openssl rand -hex 8)
  b64(){ printf '%s' "$1" | openssl base64 -A | tr '+/' '-_' | tr -d '='; }
  sign(){ local h p s; h=$(b64 '{"alg":"HS256","typ":"JWT"}'); p=$(b64 "$1")
    s=$(printf '%s' "$h.$p" | openssl dgst -sha256 -hmac "$JWT" -binary | openssl base64 -A | tr '+/' '-_' | tr -d '='); echo "$h.$p.$s"; }
  EXP=$(( $(date +%s) + 10*365*86400 ))
  ANON=$(sign "{\"role\":\"anon\",\"iss\":\"supabase\",\"iat\":$(date +%s),\"exp\":$EXP}")
  SRV=$(sign "{\"role\":\"service_role\",\"iss\":\"supabase\",\"iat\":$(date +%s),\"exp\":$EXP}")
  sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$PG|;s|^JWT_SECRET=.*|JWT_SECRET=$JWT|;s|^ANON_KEY=.*|ANON_KEY=$ANON|;s|^SERVICE_ROLE_KEY=.*|SERVICE_ROLE_KEY=$SRV|;s|^DASHBOARD_PASSWORD=.*|DASHBOARD_PASSWORD=$DASH|;s|^SITE_URL=.*|SITE_URL=http://$LAN_IP|;s|^API_EXTERNAL_URL=.*|API_EXTERNAL_URL=http://$LAN_IP:8000|;s|^SUPABASE_PUBLIC_URL=.*|SUPABASE_PUBLIC_URL=http://$LAN_IP:8000|;s|^ENABLE_EMAIL_AUTOCONFIRM=.*|ENABLE_EMAIL_AUTOCONFIRM=true|" .env
  chmod 600 .env
fi
set -a; . ./.env; set +a
# edge functions ของระบบ
rm -rf volumes/functions/* && cp -r "$ROOT/supabase/functions/." volumes/functions/
# บอก edge functions ว่าติดตั้งในโรงเรียน → เก็บไฟล์บน HDD ไม่ย้ายขึ้น Google Drive
[ -f "$STACK/cron-secret" ] || openssl rand -hex 24 > "$STACK/cron-secret"; chmod 600 "$STACK/cron-secret"
CRON_SECRET=$(cat "$STACK/cron-secret")
cat > docker-compose.override.yml <<YAML
services:
  functions:
    environment:
      DEPLOY_MODE: "$MODE"
      CRON_SECRET: "$CRON_SECRET"
YAML
docker compose up -d
echo "-> รอฐานข้อมูลพร้อม"; for i in $(seq 1 60); do docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1 && break; sleep 3; done

# 3) ตาราง/สิทธิ์/ฟังก์ชันทั้งหมด
cd "$ROOT"; bash scripts/build-migration-bundle.sh
docker compose -f "$STACK/supabase/docker-compose.yml" exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=0 < dist/bundle/schema-bundle.sql >"$STACK/schema-install.log" 2>&1 || true

# 4) หน้าเว็บ (ชี้ไปเครื่องนี้ผ่าน app-config.js ไม่ต้องแก้โค้ด)
npm ci --no-audit --no-fund && npm run build
mkdir -p "$STACK/web" && rm -rf "$STACK/web/"* && cp -r dist/. "$STACK/web/"
cat > "$STACK/web/app-config.js" <<EOF
window.__BNG_CONFIG__ = {
  SUPABASE_URL: "http://$LAN_IP:8000",
  SUPABASE_ANON_KEY: "$ANON_KEY",
  SUPABASE_PROJECT_ID: "local",
  STORAGE_PROVIDER: "supabase",
  DEPLOY_MODE: "$MODE"
};
EOF
cp "$ROOT/deploy/standalone/nginx.conf" "$STACK/nginx.conf"
docker rm -f school-web >/dev/null 2>&1 || true
docker run -d --name school-web --restart unless-stopped -p 80:80 \
  -v "$STACK/web:/usr/share/nginx/html:ro" -v "$STACK/nginx.conf:/etc/nginx/conf.d/default.conf:ro" nginx:alpine

# 5) สำรองข้อมูลอัตโนมัติทุกคืน 02:00 (+ ส่งขึ้น Cloud ถ้าแบบผสม)
install -m 755 "$ROOT/deploy/standalone/backup.sh" /usr/local/bin/school-backup
install -m 755 "$ROOT/deploy/standalone/restore.sh" /usr/local/bin/school-restore
install -m 755 "$ROOT/deploy/standalone/update.sh" /usr/local/bin/school-update
echo "$ROOT" > "$STACK/repo-path"
# งานส่งข้อมูลให้เขต + ส่งคิวค้าง (ใช้ service key ภายในเครื่อง)
( crontab -l 2>/dev/null | grep -v school-district; \
  echo "30 1 * * * curl -s -X POST -H 'x-cron-secret: $CRON_SECRET' -H 'apikey: $ANON_KEY' http://localhost:8000/functions/v1/district-nightly-snapshot >/dev/null # school-district"; \
  echo "*/10 * * * * curl -s -X POST -H 'x-cron-secret: $CRON_SECRET' -H 'apikey: $ANON_KEY' http://localhost:8000/functions/v1/district-outbox-worker >/dev/null # school-district" ) | crontab -
echo "MODE=$MODE" > "$STACK/backup.env"
( crontab -l 2>/dev/null | grep -v school-backup; echo "0 2 * * * /usr/local/bin/school-backup >> $STACK/backup.log 2>&1" ) | crontab -

cat <<EOF

========================================================
 ติดตั้งเสร็จ ($MODE)
 เปิดระบบ:          http://$LAN_IP
 ระบบจัดการฐานข้อมูล: http://$LAN_IP:8000  (user: supabase / pass: ดูใน $STACK/supabase/.env)
 FaceGate agent:    ใส่ URL http://$LAN_IP:8000/functions/v1/kiosk-api
 ขั้นต่อไป: สมัครผู้ใช้คนแรก แล้วรัน
   sudo bash deploy/standalone/make-admin.sh you@school.ac.th
========================================================
EOF
