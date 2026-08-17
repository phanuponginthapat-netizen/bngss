-- 1) Remove overly-permissive class-wide homework UPDATE policy
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Students can submit class-wide homework" ON public.task_assignments';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- 2) Remove denylist anon policy on cms_settings (allowlist policy remains)
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Anon view public cms keys" ON public.cms_settings';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
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
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users insert own kiosk device" ON public.kiosk_devices';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users insert own kiosk device" ON public.kiosk_devices';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Users insert own kiosk device"
ON public.kiosk_devices
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid())';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
