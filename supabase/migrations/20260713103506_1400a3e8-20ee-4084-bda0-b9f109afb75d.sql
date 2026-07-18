
DROP FUNCTION IF EXISTS public.search_chat_users(TEXT);

CREATE FUNCTION public.search_chat_users(_term TEXT)
RETURNS TABLE (
  id UUID,
  first_name TEXT,
  last_name TEXT,
  nickname TEXT,
  avatar_url TEXT,
  student_code TEXT,
  employee_code TEXT,
  role TEXT,
  department TEXT,
  classroom_id UUID,
  rank_score INT
)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH me AS (
    SELECT
      p.id,
      p.department,
      (SELECT ur.role::text FROM public.user_roles ur WHERE ur.user_id = p.id LIMIT 1) AS role,
      (
        SELECT e.classroom_id
        FROM public.enrollments e
        JOIN public.students s ON s.id = e.student_id
        WHERE s.auth_user_id = p.id AND e.classroom_id IS NOT NULL
        ORDER BY e.academic_year DESC, e.semester DESC NULLS LAST
        LIMIT 1
      ) AS classroom_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
  SELECT
    p.id,
    p.first_name,
    p.last_name,
    p.nickname,
    p.avatar_url,
    p.student_code,
    p.employee_code,
    ur.role::text AS role,
    p.department,
    ce.classroom_id,
    (
      CASE WHEN ce.classroom_id IS NOT NULL AND ce.classroom_id = (SELECT classroom_id FROM me) THEN 0 ELSE 100 END
      + CASE WHEN p.department IS NOT NULL AND p.department = (SELECT department FROM me) THEN 0 ELSE 20 END
      + CASE WHEN ur.role::text = 'teacher' THEN 0
             WHEN ur.role::text = (SELECT role FROM me) THEN 5
             ELSE 10 END
    )::int AS rank_score
  FROM public.profiles p
  LEFT JOIN LATERAL (
    SELECT ur2.role FROM public.user_roles ur2 WHERE ur2.user_id = p.id LIMIT 1
  ) ur ON TRUE
  LEFT JOIN LATERAL (
    SELECT e.classroom_id
    FROM public.enrollments e
    JOIN public.students s ON s.id = e.student_id
    WHERE s.auth_user_id = p.id AND e.classroom_id IS NOT NULL
    ORDER BY e.academic_year DESC, e.semester DESC NULLS LAST
    LIMIT 1
  ) ce ON TRUE
  WHERE p.id <> auth.uid()
    AND (
      public.get_user_school_id(auth.uid()) IS NULL
      OR p.school_id IS NULL
      OR p.school_id = public.get_user_school_id(auth.uid())
    )
    AND (
      COALESCE(_term, '') = ''
      OR p.first_name    ILIKE '%' || _term || '%'
      OR p.last_name     ILIKE '%' || _term || '%'
      OR p.nickname      ILIKE '%' || _term || '%'
      OR p.student_code  ILIKE '%' || _term || '%'
      OR p.employee_code ILIKE '%' || _term || '%'
    )
  ORDER BY rank_score ASC, p.first_name NULLS LAST, p.last_name NULLS LAST
  LIMIT 50;
$$;

REVOKE ALL ON FUNCTION public.search_chat_users(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_chat_users(TEXT) TO authenticated;
