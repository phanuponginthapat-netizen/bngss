-- ConnextedScan kiosk agent integration
-- เพิ่มทะเบียนเครื่องสแกน (device key) + ตารางรองรับการแจ้งเตือน/ผู้มาติดต่อ/คำสั่งเครื่อง/ภาพสด
-- idempotent: รันซ้ำได้

-- ── 1) ทะเบียนเครื่องคีออส (ใช้ตารางเดิม kiosk_devices) ──────────────────────
ALTER TABLE public.kiosk_devices
  ADD COLUMN IF NOT EXISTS device_key        text,
  ADD COLUMN IF NOT EXISTS name              text,
  ADD COLUMN IF NOT EXISTS default_direction text NOT NULL DEFAULT 'in',
  ADD COLUMN IF NOT EXISTS agent_version     text,
  ADD COLUMN IF NOT EXISTS platform          text,
  ADD COLUMN IF NOT EXISTS disk_free_mb      integer,
  ADD COLUMN IF NOT EXISTS camera_ok         boolean,
  ADD COLUMN IF NOT EXISTS door_ok           boolean,
  ADD COLUMN IF NOT EXISTS health_note       text,
  ADD COLUMN IF NOT EXISTS is_active         boolean NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS kiosk_devices_device_key_uniq
  ON public.kiosk_devices (device_key) WHERE device_key IS NOT NULL;

-- ── 2) แจ้งเตือนคนแปลกหน้า ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kiosk_agent_alerts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id    text,
  device_name  text,
  kind         text NOT NULL DEFAULT 'unknown_face',
  snapshot_url text,
  note         text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.kiosk_agent_alerts TO authenticated;
GRANT ALL    ON public.kiosk_agent_alerts TO service_role;
ALTER TABLE public.kiosk_agent_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff read kiosk alerts" ON public.kiosk_agent_alerts;
CREATE POLICY "staff read kiosk alerts" ON public.kiosk_agent_alerts
  FOR SELECT TO authenticated USING (public._staff_check(auth.uid()));

-- ── 3) ผู้มาติดต่อ ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kiosk_visitors (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id    text,
  device_name  text,
  full_name    text,
  phone        text,
  purpose      text,
  direction    text,
  snapshot_url text,
  visited_at   timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.kiosk_visitors TO authenticated;
GRANT ALL    ON public.kiosk_visitors TO service_role;
ALTER TABLE public.kiosk_visitors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff read kiosk visitors" ON public.kiosk_visitors;
CREATE POLICY "staff read kiosk visitors" ON public.kiosk_visitors
  FOR SELECT TO authenticated USING (public._staff_check(auth.uid()));

-- ── 4) คำสั่งถึงเครื่อง (เปิดประตู / ปิด-เปิดเครื่อง / รีบูต) ───────────────
CREATE TABLE IF NOT EXISTS public.kiosk_commands (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id   text NOT NULL,
  kind        text NOT NULL,             -- 'door' | 'power'
  action      text NOT NULL,             -- open/close | reboot/shutdown/screen_off/screen_on
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by  uuid,
  consumed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS kiosk_commands_pending_idx
  ON public.kiosk_commands (device_id, created_at) WHERE consumed_at IS NULL;
GRANT SELECT, INSERT ON public.kiosk_commands TO authenticated;
GRANT ALL ON public.kiosk_commands TO service_role;
ALTER TABLE public.kiosk_commands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff read kiosk commands" ON public.kiosk_commands;
CREATE POLICY "staff read kiosk commands" ON public.kiosk_commands
  FOR SELECT TO authenticated USING (public._staff_check(auth.uid()));
DROP POLICY IF EXISTS "staff send kiosk commands" ON public.kiosk_commands;
CREATE POLICY "staff send kiosk commands" ON public.kiosk_commands
  FOR INSERT TO authenticated WITH CHECK (public._staff_check(auth.uid()));

-- ── 5) ภาพสดหน้าตู้ (เก็บเฟรมล่าสุดของแต่ละเครื่อง) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.kiosk_live_frames (
  device_id  text PRIMARY KEY,
  image      text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.kiosk_live_frames TO authenticated;
GRANT ALL    ON public.kiosk_live_frames TO service_role;
ALTER TABLE public.kiosk_live_frames ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff read kiosk live" ON public.kiosk_live_frames;
CREATE POLICY "staff read kiosk live" ON public.kiosk_live_frames
  FOR SELECT TO authenticated USING (public._staff_check(auth.uid()));
