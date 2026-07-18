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

GRANT EXECUTE ON FUNCTION public.list_school_members() TO authenticated;