
CREATE OR REPLACE FUNCTION public.search_chat_users(_term TEXT)
RETURNS TABLE (
  id UUID,
  first_name TEXT,
  last_name TEXT,
  nickname TEXT,
  avatar_url TEXT,
  student_code TEXT,
  employee_code TEXT
)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.first_name, p.last_name, p.nickname, p.avatar_url, p.student_code, p.employee_code
  FROM public.profiles p
  WHERE p.id <> auth.uid()
    AND (
      public.get_user_school_id(auth.uid()) IS NULL
      OR p.school_id IS NULL
      OR p.school_id = public.get_user_school_id(auth.uid())
    )
    AND (
      COALESCE(_term, '') = ''
      OR p.first_name ILIKE '%' || _term || '%'
      OR p.last_name ILIKE '%' || _term || '%'
      OR p.nickname ILIKE '%' || _term || '%'
      OR p.student_code ILIKE '%' || _term || '%'
      OR p.employee_code ILIKE '%' || _term || '%'
    )
  ORDER BY p.first_name NULLS LAST, p.last_name NULLS LAST
  LIMIT 30;
$$;

REVOKE ALL ON FUNCTION public.search_chat_users(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_chat_users(TEXT) TO authenticated;

-- also expose participant profiles for existing conversations
CREATE OR REPLACE FUNCTION public.get_chat_user_profiles(_ids UUID[])
RETURNS TABLE (
  id UUID,
  first_name TEXT,
  last_name TEXT,
  nickname TEXT,
  avatar_url TEXT,
  student_code TEXT,
  employee_code TEXT
)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.first_name, p.last_name, p.nickname, p.avatar_url, p.student_code, p.employee_code
  FROM public.profiles p
  WHERE p.id = ANY(_ids);
$$;
REVOKE ALL ON FUNCTION public.get_chat_user_profiles(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_chat_user_profiles(UUID[]) TO authenticated;
