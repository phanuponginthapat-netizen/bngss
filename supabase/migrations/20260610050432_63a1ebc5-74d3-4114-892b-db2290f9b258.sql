CREATE OR REPLACE FUNCTION public.get_staff_profiles()
RETURNS TABLE (id uuid, first_name text, last_name text, phone text, position_title text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.first_name, p.last_name, p.phone, p.position_title
  FROM public.profiles p
  WHERE EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p.id
      AND ur.role IN ('admin'::app_role, 'director'::app_role, 'teacher'::app_role)
  )
  ORDER BY p.first_name NULLS LAST, p.last_name NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_staff_profiles() TO authenticated;