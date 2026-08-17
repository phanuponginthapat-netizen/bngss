-- (schools row already seeded in previous migration attempt)
INSERT INTO public.schools (school_code, school_name, address, phone, email, director_name, logo_url, is_active)
SELECT 'SINGLE_SCHOOL',
  COALESCE((SELECT value FROM public.cms_settings WHERE key='school_name'), 'โรงเรียน'),
  (SELECT value FROM public.cms_settings WHERE key='school_address'),
  (SELECT value FROM public.cms_settings WHERE key='school_phone'),
  (SELECT value FROM public.cms_settings WHERE key='school_email'),
  (SELECT value FROM public.cms_settings WHERE key='director_name'),
  (SELECT value FROM public.cms_settings WHERE key='school_logo'),
  true
WHERE NOT EXISTS (SELECT 1 FROM public.schools);
DROP FUNCTION IF EXISTS public.current_school_id() CASCADE;
CREATE OR REPLACE FUNCTION public.current_school_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT id FROM public.schools ORDER BY created_at ASC LIMIT 1
$$;
DO $guard$
BEGIN
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.current_school_id() TO authenticated, anon, service_role';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- Backfill NULL school_id + set DEFAULT, disabling triggers per table to bypass admin-only guards during backfill
DO $$
DECLARE
  r RECORD;
  sid uuid := public.current_school_id();
BEGIN
  FOR r IN
    SELECT c.table_name
    FROM information_schema.columns c
    WHERE c.table_schema='public' AND c.column_name='school_id'
      AND c.table_name <> 'schools'
      AND EXISTS (SELECT 1 FROM information_schema.tables t
                  WHERE t.table_schema='public' AND t.table_name=c.table_name AND t.table_type='BASE TABLE')
  LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER USER', r.table_name);
    EXECUTE format('UPDATE public.%I SET school_id=%L WHERE school_id IS NULL', r.table_name, sid);
    EXECUTE format('ALTER TABLE public.%I ENABLE TRIGGER USER', r.table_name);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN school_id SET DEFAULT public.current_school_id()', r.table_name);
  END LOOP;
END $$;
-- Enforce single school going forward
DROP FUNCTION IF EXISTS public.enforce_single_school() CASCADE;
CREATE OR REPLACE FUNCTION public.enforce_single_school()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT count(*) FROM public.schools) >= 1 THEN
    RAISE EXCEPTION 'ระบบนี้รองรับ 1 โรงเรียนเท่านั้น (single-tenant)';
  END IF;
  RETURN NEW;
END $$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_enforce_single_school ON public.schools';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_enforce_single_school
  BEFORE INSERT ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.enforce_single_school()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
