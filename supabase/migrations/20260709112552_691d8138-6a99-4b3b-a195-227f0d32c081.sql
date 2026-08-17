CREATE TABLE IF NOT EXISTS public.kiosk_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL UNIQUE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  hostname text,
  user_agent text,
  ip_address text,
  status text NOT NULL DEFAULT 'online',
  kiosk_mode text,
  config_updated_at timestamptz,
  uptime_sec integer NOT NULL DEFAULT 0,
  screen_resolution text,
  extension_installed boolean NOT NULL DEFAULT false,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kiosk_devices TO authenticated;
GRANT ALL ON public.kiosk_devices TO service_role;

ALTER TABLE public.kiosk_devices ENABLE ROW LEVEL SECURITY;

-- ทุกคนที่ล็อกอินอยู่ อัปเดต/สร้างแถวของตัวเองได้ (ส่ง heartbeat)
DROP POLICY IF EXISTS "users can upsert own device row" ON public.kiosk_devices;
DROP POLICY IF EXISTS "users can upsert own device row" ON public.kiosk_devices;
CREATE POLICY "users can upsert own device row"
  ON public.kiosk_devices
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

DROP POLICY IF EXISTS "users can update own device row" ON public.kiosk_devices;
DROP POLICY IF EXISTS "users can update own device row" ON public.kiosk_devices;
CREATE POLICY "users can update own device row"
  ON public.kiosk_devices
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director') OR public.has_role(auth.uid(), 'teacher'))
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director') OR public.has_role(auth.uid(), 'teacher'));

-- admin / director / teacher: ดูเครื่องทั้งหมด
DROP POLICY IF EXISTS "staff can view all devices" ON public.kiosk_devices;
DROP POLICY IF EXISTS "staff can view all devices" ON public.kiosk_devices;
CREATE POLICY "staff can view all devices"
  ON public.kiosk_devices
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'director')
    OR public.has_role(auth.uid(), 'teacher')
    OR user_id = auth.uid()
  );

-- admin / director: ลบเครื่องได้
DROP POLICY IF EXISTS "admins can delete devices" ON public.kiosk_devices;
DROP POLICY IF EXISTS "admins can delete devices" ON public.kiosk_devices;
CREATE POLICY "admins can delete devices"
  ON public.kiosk_devices
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

CREATE INDEX IF NOT EXISTS kiosk_devices_last_seen_idx ON public.kiosk_devices (last_seen_at DESC);
CREATE INDEX IF NOT EXISTS kiosk_devices_user_id_idx ON public.kiosk_devices (user_id);
CREATE INDEX IF NOT EXISTS kiosk_devices_status_idx ON public.kiosk_devices (status);

DROP TRIGGER IF EXISTS kiosk_devices_updated_at ON public.kiosk_devices;
CREATE TRIGGER kiosk_devices_updated_at
  BEFORE UPDATE ON public.kiosk_devices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DO $$

BEGIN

  IF NOT EXISTS (

    SELECT 1 FROM pg_publication_tables

    WHERE pubname = 'supabase_realtime'

      AND schemaname = 'public'

      AND tablename = 'kiosk_devices'

  ) THEN

    ALTER PUBLICATION supabase_realtime ADD TABLE public.kiosk_devices;

  END IF;

END $$;
ALTER TABLE public.kiosk_devices REPLICA IDENTITY FULL;