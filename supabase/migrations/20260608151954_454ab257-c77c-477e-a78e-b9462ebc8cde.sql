DROP FUNCTION IF EXISTS public.list_school_members() CASCADE;
CREATE OR REPLACE FUNCTION public.list_school_members()
RETURNS TABLE (
  id uuid,
  first_name text,
  last_name text,
  avatar_url text,
  position_title text,
  department text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.first_name, p.last_name, p.avatar_url, p.position_title, p.department
  FROM public.profiles p
  WHERE p.school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
    AND p.school_id IS NOT NULL
  ORDER BY p.first_name NULLS LAST, p.last_name NULLS LAST;
$$;
DO $guard$
BEGIN
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.list_school_members() TO authenticated';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
