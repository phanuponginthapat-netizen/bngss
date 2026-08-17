DROP FUNCTION IF EXISTS public.search_public_profiles(text) CASCADE;
CREATE OR REPLACE FUNCTION public.search_public_profiles(_q text)
RETURNS TABLE (
  id uuid,
  first_name text,
  last_name text,
  nickname text,
  avatar_url text,
  student_code text,
  employee_code text,
  role_label text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH q AS (
    SELECT lower(trim(coalesce(_q, ''))) AS term
  )
  SELECT
    p.id,
    p.first_name,
    p.last_name,
    p.nickname,
    p.avatar_url,
    p.student_code,
    p.employee_code,
    CASE
      WHEN p.student_code IS NOT NULL AND length(p.student_code) > 0 THEN 'นักเรียน'
      WHEN p.employee_code IS NOT NULL AND length(p.employee_code) > 0 THEN 'บุคลากร'
      ELSE NULL
    END AS role_label
  FROM public.profiles p, q
  WHERE q.term <> ''
    AND length(q.term) >= 2
    AND p.is_approved = true
    AND (
      lower(p.student_code)  = q.term
      OR lower(p.employee_code) = q.term
      OR lower(coalesce(p.first_name, '')) LIKE q.term || '%'
      OR lower(coalesce(p.last_name, ''))  LIKE q.term || '%'
      OR lower(coalesce(p.nickname, ''))   LIKE q.term || '%'
      OR lower(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')) LIKE '%' || q.term || '%'
    )
  ORDER BY
    CASE WHEN lower(p.student_code) = q.term OR lower(p.employee_code) = q.term THEN 0 ELSE 1 END,
    p.first_name NULLS LAST,
    p.last_name NULLS LAST
  LIMIT 20
$$;
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'GRANT EXECUTE ON FUNCTION public.search_public_profiles(text) TO anon, authenticated, service_role';
    EXIT;
    EXCEPTION
      WHEN deadlock_detected OR lock_not_available THEN
        _ddl_try := _ddl_try + 1;
        IF _ddl_try >= 10 THEN
          RAISE NOTICE 'giving up after lock contention: %', SQLERRM;
          EXIT;
        END IF;
        PERFORM pg_sleep(0.4 * _ddl_try);
      WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
        RAISE NOTICE 'skipped: %', SQLERRM;
        EXIT;
    END;
  END LOOP;
END
$guard$;
