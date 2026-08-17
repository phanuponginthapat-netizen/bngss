DROP FUNCTION IF EXISTS public.self_enroll_face(jsonb, text[], text) CASCADE;
CREATE OR REPLACE FUNCTION public.self_enroll_face(_samples jsonb, _photo_urls text[] DEFAULT '{}', _reason text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _student_id uuid;
  _next int;
  _is_rereg boolean;
  _s jsonb;
  _req_id uuid;
BEGIN
  SELECT id INTO _student_id FROM public.students WHERE auth_user_id = auth.uid() LIMIT 1;
  IF _student_id IS NULL THEN
    RAISE EXCEPTION 'ไม่พบข้อมูลนักเรียนของบัญชีนี้';
  END IF;
  IF _samples IS NULL OR jsonb_array_length(_samples) = 0 THEN
    RAISE EXCEPTION 'ไม่มีตัวอย่างใบหน้า';
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.student_face_descriptors WHERE student_id = _student_id) INTO _is_rereg;
  SELECT COALESCE(MAX(sample_index) + 1, 0) INTO _next FROM public.student_face_descriptors WHERE student_id = _student_id;

  FOR _s IN SELECT * FROM jsonb_array_elements(_samples) LOOP
    INSERT INTO public.student_face_descriptors
      (student_id, sample_index, descriptor, quality_score, face_image, metrics, captured_by, source)
    VALUES (
      _student_id,
      _next,
      ARRAY(SELECT (jsonb_array_elements_text(_s->'descriptor'))::real),
      NULLIF(_s->>'quality_score','')::real,
      _s->>'face_image',
      COALESCE(_s->'metrics', '{}'::jsonb),
      auth.uid(),
      'self_enroll_auto'
    );
    _next := _next + 1;
  END LOOP;

  INSERT INTO public.face_registration_requests
    (student_id, requested_by, request_type, reason, photo_urls, descriptors, status, reviewed_by, reviewed_at, review_notes)
  VALUES (
    _student_id, auth.uid(),
    CASE WHEN _is_rereg THEN 'reregister' ELSE 'initial' END,
    NULLIF(_reason,''),
    _photo_urls,
    (SELECT jsonb_agg(x->'descriptor') FROM jsonb_array_elements(_samples) x),
    'approved', auth.uid(), now(), 'อนุมัติอัตโนมัติ (ผ่าน Liveness)'
  ) RETURNING id INTO _req_id;

  RETURN _req_id;
END;
$$;
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'REVOKE ALL ON FUNCTION public.self_enroll_face(jsonb, text[], text) FROM public';
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
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'GRANT EXECUTE ON FUNCTION public.self_enroll_face(jsonb, text[], text) TO authenticated';
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
