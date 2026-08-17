
-- 1) Remove overly-permissive class-wide homework UPDATE policy
DROP POLICY IF EXISTS "Students can submit class-wide homework" ON public.task_assignments;

-- 2) Remove denylist anon policy on cms_settings (allowlist policy remains)
DROP POLICY IF EXISTS "Anon view public cms keys" ON public.cms_settings;

-- 3) Tighten kiosk_devices INSERT: require user_id = auth.uid()
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT polname FROM pg_policy
    WHERE polrelid='public.kiosk_devices'::regclass AND polcmd='a'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.kiosk_devices', p.polname);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Users insert own kiosk device" ON public.kiosk_devices;
CREATE POLICY "Users insert own kiosk device"
ON public.kiosk_devices
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());
