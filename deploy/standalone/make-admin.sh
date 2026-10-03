#!/usr/bin/env bash
# ให้สิทธิ์ผู้ดูแลระบบกับบัญชีที่สมัครแล้ว:  sudo bash make-admin.sh admin@school.ac.th
set -euo pipefail
EMAIL="${1:?ใส่อีเมล}"
cd /opt/school-stack/supabase
docker compose exec -T db psql -U postgres -d postgres -c \
"insert into public.user_roles (user_id, role) select id, 'admin' from auth.users where email = '$EMAIL' on conflict do nothing;"
echo "ให้สิทธิ์ admin กับ $EMAIL แล้ว"
