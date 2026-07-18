-- 1) Remove ai_provider_keys from realtime publication (plaintext API keys must not stream)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ai_provider_keys'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.ai_provider_keys';
  END IF;
END $$;

-- 2) Defensive: drop any blanket "true" SELECT policy on iot_devices if it exists
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='iot_devices' AND cmd='SELECT' AND qual='true'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.iot_devices', r.policyname);
  END LOOP;
END $$;

-- Make sure iot_devices SELECT is restricted to staff (admin/director/teacher) only
DROP POLICY IF EXISTS "Staff can view iot devices" ON public.iot_devices;
CREATE POLICY "Staff can view iot devices"
ON public.iot_devices FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'director'::app_role)
  OR has_role(auth.uid(), 'teacher'::app_role)
);

-- The existing "Admin/Director view iot devices" policy stays as well (OR semantics across policies)