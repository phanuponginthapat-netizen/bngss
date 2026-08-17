DROP FUNCTION IF EXISTS public.prevent_sensitive_profile_self_update() CASCADE;
CREATE OR REPLACE FUNCTION public.prevent_sensitive_profile_self_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() = OLD.id THEN
    IF NEW.student_code IS DISTINCT FROM OLD.student_code THEN
      RAISE EXCEPTION 'student_code can only be modified by an administrator';
    END IF;
    IF NEW.employee_code IS DISTINCT FROM OLD.employee_code THEN
      RAISE EXCEPTION 'employee_code can only be modified by an administrator';
    END IF;
    IF NEW.national_id IS DISTINCT FROM OLD.national_id THEN
      RAISE EXCEPTION 'national_id can only be modified by an administrator';
    END IF;
    IF NEW.school_id IS DISTINCT FROM OLD.school_id THEN
      RAISE EXCEPTION 'school_id can only be modified by an administrator';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_prevent_sensitive_profile_self_update ON public.profiles';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_prevent_sensitive_profile_self_update
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_sensitive_profile_self_update()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Authenticated can read asset photos" ON storage.objects';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Authenticated can read asset photos" ON storage.objects';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Authenticated can read asset photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = ''asset-photos'')';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'salary_records','audit_logs','pdpa_consents','student_subsidies',
    'student_screenings','home_visits','staff_evaluations','pa_agreements',
    'pa_indicator_scores','procurement_records','budget_transactions',
    'account_balances','student_face_descriptors'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = t AND schemaname = 'public'
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t);
    END IF;
  END LOOP;
END$$;
