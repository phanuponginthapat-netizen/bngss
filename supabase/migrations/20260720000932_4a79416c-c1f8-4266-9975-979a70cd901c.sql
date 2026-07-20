
CREATE OR REPLACE FUNCTION public.resolve_scanned_student(_input text)
RETURNS TABLE (
  id uuid,
  student_code text,
  prefix text,
  first_name text,
  last_name text,
  classroom_id uuid,
  auth_user_id uuid,
  photo_url text,
  grade_level text,
  classroom_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_input text := btrim(coalesce(_input, ''));
  v_extracted text := v_input;
  v_is_uuid boolean := false;
  v_hint text := NULL;
  v_url_parts text[];
BEGIN
  IF v_input = '' THEN RETURN; END IF;
  -- allow only authenticated users
  IF auth.uid() IS NULL THEN RETURN; END IF;

  -- URL parsing
  IF v_input ~* '^https?://' THEN
    -- try query params ?code / ?sid / ?student
    v_extracted := coalesce(
      substring(v_input from '[?&]code=([^&#]+)'),
      substring(v_input from '[?&]sid=([^&#]+)'),
      substring(v_input from '[?&]student=([^&#]+)'),
      NULL
    );
    IF v_extracted IS NULL THEN
      -- take last two path parts as hint/value
      v_url_parts := regexp_split_to_array(
        regexp_replace(v_input, '^https?://[^/]+', ''),
        '/'
      );
      -- strip empties
      v_url_parts := array(SELECT x FROM unnest(v_url_parts) x WHERE x <> '');
      IF array_length(v_url_parts, 1) >= 2 THEN
        v_hint := v_url_parts[array_length(v_url_parts,1) - 1];
        v_extracted := split_part(v_url_parts[array_length(v_url_parts,1)], '?', 1);
      ELSIF array_length(v_url_parts, 1) = 1 THEN
        v_extracted := split_part(v_url_parts[1], '?', 1);
      END IF;
    END IF;
  ELSE
    v_extracted := coalesce(substring(v_input from '(?:code|student|sid)[=/:]([A-Za-z0-9_-]+)'), v_input);
  END IF;

  v_extracted := btrim(coalesce(v_extracted, ''));
  v_is_uuid := v_extracted ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

  RETURN QUERY
  SELECT s.id, s.student_code, s.prefix, s.first_name, s.last_name,
         s.classroom_id, s.auth_user_id, s.photo_url,
         c.grade_level, c.name
  FROM public.students s
  LEFT JOIN public.classrooms c ON c.id = s.classroom_id
  WHERE
    s.student_code = v_extracted
    OR (v_is_uuid AND s.id::text = v_extracted)
    OR (v_is_uuid AND s.auth_user_id::text = v_extracted)
  ORDER BY (s.student_code = v_extracted) DESC
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_scanned_student(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_scanned_student(text) TO authenticated;
