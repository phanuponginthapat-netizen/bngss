CREATE OR REPLACE FUNCTION public.get_personnel_avatars(_user_ids uuid[])
RETURNS TABLE (id uuid, avatar_url text, position_title text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pr.id, pr.avatar_url, pr.position_title
  FROM public.profiles pr
  WHERE pr.id = ANY(_user_ids);
$$;

GRANT EXECUTE ON FUNCTION public.get_personnel_avatars(uuid[]) TO anon, authenticated;