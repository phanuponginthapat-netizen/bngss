
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
  WITH me AS (
    SELECT school_id FROM public.profiles WHERE id = auth.uid()
  )
  SELECT p.id, p.first_name, p.last_name, p.avatar_url, p.position_title, p.department
  FROM public.profiles p
  WHERE p.is_approved = true
    AND (
      -- single-school / unconfigured deployment: show everyone
      (SELECT school_id FROM me) IS NULL
      -- multi-tenant: same school only
      OR p.school_id = (SELECT school_id FROM me)
    )
  ORDER BY p.first_name NULLS LAST, p.last_name NULLS LAST;
$$;
