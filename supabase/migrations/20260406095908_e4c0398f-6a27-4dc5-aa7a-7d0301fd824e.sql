-- Add user_id to personnel table
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'ALTER TABLE public.personnel ADD COLUMN IF NOT EXISTS user_id UUID UNIQUE';
    EXIT;
    EXCEPTION
      WHEN deadlock_detected OR lock_not_available THEN
        _ddl_try := _ddl_try + 1;
        IF _ddl_try >= 10 THEN
          RAISE NOTICE 'giving up after lock contention: %', SQLERRM;
          EXIT;
        END IF;
        PERFORM pg_sleep(0.4 * _ddl_try);
      WHEN insufficient_privilege OR undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
        RAISE NOTICE 'skipped: %', SQLERRM;
        EXIT;
    END;
  END LOOP;
END
$guard$;
-- Create function to auto-link personnel when profile is created
DROP FUNCTION IF EXISTS public.auto_link_personnel_on_profile() CASCADE;
CREATE OR REPLACE FUNCTION public.auto_link_personnel_on_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p_email TEXT;
  p_employee_code TEXT;
BEGIN
  -- Get email from auth.users
  SELECT email INTO p_email FROM auth.users WHERE id = NEW.id;
  
  -- Get employee_code from profile
  p_employee_code := NEW.employee_code;
  
  -- Try to match by email first, then by employee_code
  IF p_email IS NOT NULL THEN
    UPDATE public.personnel 
    SET user_id = NEW.id 
    WHERE email = p_email AND user_id IS NULL;
  END IF;
  
  IF p_employee_code IS NOT NULL AND NOT FOUND THEN
    UPDATE public.personnel 
    SET user_id = NEW.id 
    WHERE employee_code = p_employee_code AND user_id IS NULL;
  END IF;
  
  RETURN NEW;
END;
$$;
-- Trigger to auto-link on profile insert/update
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'DROP TRIGGER IF EXISTS trigger_auto_link_personnel ON public.profiles';
    EXIT;
    EXCEPTION
      WHEN deadlock_detected OR lock_not_available THEN
        _ddl_try := _ddl_try + 1;
        IF _ddl_try >= 10 THEN
          RAISE NOTICE 'giving up after lock contention: %', SQLERRM;
          EXIT;
        END IF;
        PERFORM pg_sleep(0.4 * _ddl_try);
      WHEN insufficient_privilege OR undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
        RAISE NOTICE 'skipped: %', SQLERRM;
        EXIT;
    END;
  END LOOP;
END
$guard$;
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'CREATE TRIGGER trigger_auto_link_personnel
    AFTER INSERT OR UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_link_personnel_on_profile()';
    EXIT;
    EXCEPTION
      WHEN deadlock_detected OR lock_not_available THEN
        _ddl_try := _ddl_try + 1;
        IF _ddl_try >= 10 THEN
          RAISE NOTICE 'giving up after lock contention: %', SQLERRM;
          EXIT;
        END IF;
        PERFORM pg_sleep(0.4 * _ddl_try);
      WHEN insufficient_privilege OR undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
        RAISE NOTICE 'skipped: %', SQLERRM;
        EXIT;
    END;
  END LOOP;
END
$guard$;
-- Function to get current user's linked personnel record
DROP FUNCTION IF EXISTS public.get_my_personnel() CASCADE;
CREATE OR REPLACE FUNCTION public.get_my_personnel()
RETURNS SETOF public.personnel
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.personnel WHERE user_id = auth.uid();
$$;
-- Function to get current user's linked student record
DROP FUNCTION IF EXISTS public.get_my_student() CASCADE;
CREATE OR REPLACE FUNCTION public.get_my_student()
RETURNS SETOF public.students
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.students WHERE auth_user_id = auth.uid();
$$;
