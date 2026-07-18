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
  ),
  staff_rows AS (
    SELECT
      COALESCE(p.id, pe.id) AS id,
      COALESCE(NULLIF(p.first_name, ''), pe.first_name) AS first_name,
      COALESCE(NULLIF(p.last_name, ''), pe.last_name) AS last_name,
      p.avatar_url,
      COALESCE(NULLIF(p.position_title, ''), pe.position) AS position_title,
      COALESCE(NULLIF(p.department, ''), pe.department) AS department,
      COALESCE(NULLIF(p.google_email, ''), NULLIF(pe.email, '')) AS email,
      pe.employee_code,
      NULL::text AS student_code
    FROM public.personnel pe
    LEFT JOIN LATERAL (
      SELECT pr.*
      FROM public.profiles pr
      WHERE pr.employee_code = pe.employee_code
        AND pr.is_approved = true
      ORDER BY pr.updated_at DESC, pr.created_at DESC
      LIMIT 1
    ) p ON true
    WHERE pe.status = 'active'
      AND (
        (SELECT school_id FROM me) IS NULL
        OR COALESCE(p.school_id, pe.school_id) IS NULL
        OR COALESCE(p.school_id, pe.school_id) = (SELECT school_id FROM me)
      )
  ),
  student_rows AS (
    SELECT
      COALESCE(p.id, s.id) AS id,
      COALESCE(NULLIF(p.first_name, ''), s.first_name) AS first_name,
      COALESCE(NULLIF(p.last_name, ''), s.last_name) AS last_name,
      COALESCE(NULLIF(p.avatar_url, ''), NULLIF(s.photo_url, '')) AS avatar_url,
      NULLIF(p.position_title, '') AS position_title,
      COALESCE(NULLIF(p.department, ''), c.name) AS department,
      NULLIF(p.google_email, '') AS email,
      NULL::text AS employee_code,
      s.student_code
    FROM public.students s
    LEFT JOIN public.classrooms c ON c.id = s.classroom_id
    LEFT JOIN LATERAL (
      SELECT pr.*
      FROM public.profiles pr
      WHERE pr.student_code = s.student_code
        AND pr.is_approved = true
      ORDER BY pr.updated_at DESC, pr.created_at DESC
      LIMIT 1
    ) p ON true
    WHERE s.status = 'active'
      AND (
        (SELECT school_id FROM me) IS NULL
        OR COALESCE(p.school_id, s.school_id) IS NULL
        OR COALESCE(p.school_id, s.school_id) = (SELECT school_id FROM me)
      )
  ),
  misc_profiles AS (
    SELECT
      p.id,
      p.first_name,
      p.last_name,
      p.avatar_url,
      p.position_title,
      p.department,
      p.google_email AS email,
      p.employee_code,
      p.student_code
    FROM public.profiles p
    WHERE p.is_approved = true
      AND COALESCE(NULLIF(p.employee_code, ''), NULLIF(p.student_code, '')) IS NULL
      AND (
        (SELECT school_id FROM me) IS NULL
        OR p.school_id IS NULL
        OR p.school_id = (SELECT school_id FROM me)
      )
  )
  SELECT * FROM staff_rows
  UNION ALL
  SELECT * FROM student_rows
  UNION ALL
  SELECT * FROM misc_profiles
  ORDER BY first_name NULLS LAST, last_name NULLS LAST;
$$;

CREATE OR REPLACE FUNCTION public.get_public_profile(_id uuid)
RETURNS TABLE (
  id uuid,
  first_name text,
  last_name text,
  nickname text,
  position_title text,
  department text,
  avatar_url text,
  cover_photo_url text,
  email text,
  phone text,
  school_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH profile_row AS (
    SELECT
      p.id,
      p.first_name,
      p.last_name,
      p.nickname,
      p.position_title,
      p.department,
      p.avatar_url,
      p.cover_photo_url,
      NULL::text AS email,
      NULL::text AS phone,
      s.school_name,
      1 AS priority
    FROM public.profiles p
    LEFT JOIN public.schools s ON s.id = p.school_id
    WHERE p.id = _id
      AND p.is_approved = true
  ),
  student_row AS (
    SELECT
      st.id,
      st.first_name,
      st.last_name,
      NULL::text AS nickname,
      NULL::text AS position_title,
      c.name::text AS department,
      st.photo_url AS avatar_url,
      NULL::text AS cover_photo_url,
      NULL::text AS email,
      NULL::text AS phone,
      sc.school_name,
      2 AS priority
    FROM public.students st
    LEFT JOIN public.classrooms c ON c.id = st.classroom_id
    LEFT JOIN public.schools sc ON sc.id = st.school_id
    WHERE st.id = _id
      AND st.status = 'active'
  ),
  personnel_row AS (
    SELECT
      pe.id,
      pe.first_name,
      pe.last_name,
      NULL::text AS nickname,
      pe.position AS position_title,
      pe.department,
      NULL::text AS avatar_url,
      NULL::text AS cover_photo_url,
      NULL::text AS email,
      NULL::text AS phone,
      sc.school_name,
      3 AS priority
    FROM public.personnel pe
    LEFT JOIN public.schools sc ON sc.id = pe.school_id
    WHERE pe.id = _id
      AND pe.status = 'active'
  )
  SELECT id, first_name, last_name, nickname, position_title, department, avatar_url, cover_photo_url, email, phone, school_name
  FROM (
    SELECT * FROM profile_row
    UNION ALL
    SELECT * FROM student_row
    UNION ALL
    SELECT * FROM personnel_row
  ) rows
  ORDER BY priority
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.list_school_members() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_profile(uuid) TO anon, authenticated, service_role;