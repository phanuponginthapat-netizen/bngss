-- Fix: check_face_duplicate only compared 128-D descriptors, silently skipping
-- all new 512-D ArcFace enrollments. Now compares against descriptors with the
-- SAME dimension as the probe (128-D legacy or 512-D ArcFace).
DROP FUNCTION IF EXISTS public.check_face_duplicate(uuid, jsonb, real) CASCADE;
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
  probe_dim int;
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

    CONTINUE WHEN probe IS NULL OR array_length(probe, 1) IS NULL;
    probe_dim := array_length(probe, 1);
    -- ระบบปัจจุบันใช้ ArcFace 512-D แต่ยังมี 128-D เก่าหลงเหลืออยู่ใน DB
    -- เทียบเฉพาะ descriptor ที่มีมิติเดียวกันกับ probe เท่านั้น
    CONTINUE WHEN probe_dim NOT IN (128, 512);

    SELECT d.student_id, public.face_distance(d.descriptor::real[], probe) AS dist
      INTO r
    FROM public.student_face_descriptors d
    WHERE (_student_id IS NULL OR d.student_id <> _student_id)
      AND array_length(d.descriptor, 1) = probe_dim
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
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'GRANT EXECUTE ON FUNCTION public.check_face_duplicate(uuid, jsonb, real) TO authenticated';
    EXIT;
    EXCEPTION
      WHEN deadlock_detected OR lock_not_available THEN
        _ddl_try := _ddl_try + 1;
        IF _ddl_try >= 10 THEN
          RAISE NOTICE 'giving up after lock contention: %', SQLERRM;
          EXIT;
        END IF;
        PERFORM pg_sleep(0.4 * _ddl_try);
      WHEN insufficient_privilege OR undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
        RAISE NOTICE 'skipped: %', SQLERRM;
        EXIT;
    END;
  END LOOP;
END
$guard$;