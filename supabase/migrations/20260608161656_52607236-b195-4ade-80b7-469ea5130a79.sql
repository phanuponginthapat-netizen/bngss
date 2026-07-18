
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

GRANT EXECUTE ON FUNCTION public.search_public_profiles(text) TO anon, authenticated, service_role;
