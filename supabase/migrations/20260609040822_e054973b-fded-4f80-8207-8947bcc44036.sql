DROP FUNCTION IF EXISTS public.list_school_members();
DROP FUNCTION IF EXISTS public.list_school_members() CASCADE;
CREATE OR REPLACE FUNCTION public.list_school_members()
RETURNS TABLE (
  id uuid,
  first_name text,
  last_name text,
  avatar_url text,
  position_title text,
  department text,
  email text,
  employee_code text,
  student_code text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT school_id FROM public.profiles WHERE id = auth.uid()
  )
  SELECT p.id, p.first_name, p.last_name, p.avatar_url, p.position_title, p.department,
         p.google_email, p.employee_code, p.student_code
  FROM public.profiles p
  WHERE p.is_approved = true
    AND (
      (SELECT school_id FROM me) IS NULL
      OR p.school_id = (SELECT school_id FROM me)
    )
  ORDER BY p.first_name NULLS LAST, p.last_name NULLS LAST;
$$;
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'GRANT EXECUTE ON FUNCTION public.list_school_members() TO authenticated';
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
