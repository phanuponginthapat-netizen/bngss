-- 1) Revoke direct SELECT on the api_key column from regular roles
DO $guard$
BEGIN
  EXECUTE 'REVOKE SELECT (api_key) ON public.ai_providers FROM authenticated';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'REVOKE SELECT (api_key) ON public.ai_providers FROM anon';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- 2) Prevent users from changing student_code on their own profile (admins can still change it)
DROP FUNCTION IF EXISTS public.prevent_self_student_code_change() CASCADE;
CREATE OR REPLACE FUNCTION public.prevent_self_student_code_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.student_code IS DISTINCT FROM OLD.student_code
     AND NOT public.has_role(auth.uid(), 'admin'::app_role)
     AND NOT public.has_role(auth.uid(), 'director'::app_role) THEN
    RAISE EXCEPTION 'student_code can only be changed by an administrator';
  END IF;
  RETURN NEW;
END;
$$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_prevent_self_student_code_change ON public.profiles';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_prevent_self_student_code_change
BEFORE UPDATE OF student_code ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_self_student_code_change()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
