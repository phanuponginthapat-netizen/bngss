
CREATE OR REPLACE FUNCTION public.get_public_profile(_id uuid)
RETURNS TABLE (
  id uuid,
  first_name text,
  last_name text,
  nickname text,
  position_title text,
  department text,
  avatar_url text,
  email text,
  phone text,
  school_name text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.first_name,
    p.last_name,
    p.nickname,
    p.position_title,
    p.department,
    p.avatar_url,
    p.google_email AS email,
    p.phone,
    s.school_name
  FROM public.profiles p
  LEFT JOIN public.schools s ON s.id = p.school_id
  WHERE p.id = _id
    AND p.is_approved = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_profile(uuid) TO anon, authenticated;
