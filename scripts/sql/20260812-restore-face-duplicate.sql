CREATE OR REPLACE FUNCTION public.face_distance(a real[], b real[])
RETURNS real
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT sqrt(sum((x.v - y.v) * (x.v - y.v)))::real
  FROM unnest(a) WITH ORDINALITY AS x(v, i)
  JOIN unnest(b) WITH ORDINALITY AS y(v, i) USING (i);
$$;

CREATE OR REPLACE FUNCTION public.check_face_duplicate(
  _student_id uuid,
  _descriptors jsonb,
  _threshold real DEFAULT 0.42
)
RETURNS TABLE(match_student_id uuid, match_code text, match_name text, min_distance real)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  elem jsonb;
  probe real[];
  best_id uuid;
  best_dist real := 1e9;
  r record;
BEGIN
  IF _descriptors IS NULL OR jsonb_typeof(_descriptors) <> 'array' THEN
    RETURN;
  END IF;

  FOR elem IN SELECT value FROM jsonb_array_elements(_descriptors) LOOP
    SELECT array_agg(v::real ORDER BY ord) INTO probe
    FROM jsonb_array_elements_text(elem) WITH ORDINALITY AS t(v, ord);

    CONTINUE WHEN probe IS NULL OR array_length(probe, 1) <> 128;

    SELECT d.student_id, public.face_distance(d.descriptor::real[], probe) AS dist
      INTO r
    FROM public.student_face_descriptors d
    WHERE (_student_id IS NULL OR d.student_id <> _student_id)
      AND array_length(d.descriptor, 1) = 128
    ORDER BY 2 ASC
    LIMIT 1;

    IF r.student_id IS NOT NULL AND r.dist < best_dist THEN
      best_dist := r.dist;
      best_id := r.student_id;
    END IF;
  END LOOP;

  IF best_id IS NOT NULL AND best_dist <= _threshold THEN
    RETURN QUERY
    SELECT s.id,
           s.student_code,
           btrim(concat_ws(' ', concat(coalesce(s.prefix, ''), s.first_name), s.last_name)),
           best_dist
    FROM public.students s
    WHERE s.id = best_id;
  END IF;

  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.face_distance(real[], real[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_face_duplicate(uuid, jsonb, real) TO authenticated;REVOKE ALL ON FUNCTION public.check_face_duplicate(uuid, jsonb, real) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.face_distance(real[], real[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_face_duplicate(uuid, jsonb, real) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.face_distance(real[], real[]) TO authenticated, service_role;