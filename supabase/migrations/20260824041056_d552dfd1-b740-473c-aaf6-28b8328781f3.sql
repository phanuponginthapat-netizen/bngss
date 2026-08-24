-- ---------- students ----------
CREATE OR REPLACE FUNCTION public.self_enroll_face(_samples jsonb, _photo_urls text[] DEFAULT '{}', _reason text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _student_id uuid;
  _code text;
  _next int;
  _is_rereg boolean;
  _s jsonb;
  _req_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'กรุณาเข้าสู่ระบบก่อนลงทะเบียนใบหน้า';
  END IF;

  SELECT id INTO _student_id FROM public.students WHERE auth_user_id = auth.uid() LIMIT 1;

  IF _student_id IS NULL THEN
    SELECT NULLIF(TRIM(student_code), '') INTO _code FROM public.profiles WHERE id = auth.uid();
    IF _code IS NOT NULL THEN
      SELECT id INTO _student_id FROM public.students WHERE TRIM(student_code) = _code LIMIT 1;
      -- ผูกบัญชีให้อัตโนมัติ เพื่อให้ครั้งต่อไปหาเจอทันที
      IF _student_id IS NOT NULL THEN
        UPDATE public.students SET auth_user_id = auth.uid()
        WHERE id = _student_id AND auth_user_id IS NULL;
      END IF;
    END IF;
  END IF;

  IF _student_id IS NULL THEN
    RAISE EXCEPTION 'ไม่พบข้อมูลนักเรียนของบัญชีนี้ กรุณาแจ้งผู้ดูแลระบบให้เชื่อมบัญชีกับรหัสนักเรียน';
  END IF;

  IF _samples IS NULL OR jsonb_array_length(_samples) = 0 THEN
    RAISE EXCEPTION 'ไม่มีตัวอย่างใบหน้า';
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.student_face_descriptors WHERE student_id = _student_id) INTO _is_rereg;
  SELECT COALESCE(MAX(sample_index) + 1, 0) INTO _next FROM public.student_face_descriptors WHERE student_id = _student_id;

  FOR _s IN SELECT * FROM jsonb_array_elements(_samples) LOOP
    INSERT INTO public.student_face_descriptors
      (student_id, sample_index, descriptor, quality_score, face_image, texture, metrics, captured_by, source)
    VALUES (
      _student_id,
      _next,
      ARRAY(SELECT (jsonb_array_elements_text(_s->'descriptor'))::real),
      NULLIF(_s->>'quality_score','')::real,
      _s->>'face_image',
      CASE WHEN jsonb_typeof(_s->'texture') = 'array'
           THEN ARRAY(SELECT (jsonb_array_elements_text(_s->'texture'))::real) END,
      COALESCE(_s->'metrics', '{}'::jsonb),
      auth.uid(),
      'self_enroll_auto'
    )
    ON CONFLICT (student_id, sample_index) DO NOTHING;
    _next := _next + 1;
  END LOOP;

  INSERT INTO public.face_registration_requests
    (student_id, requested_by, request_type, reason, photo_urls, descriptors, status, reviewed_by, reviewed_at, review_notes)
  VALUES (
    _student_id, auth.uid(),
    CASE WHEN _is_rereg THEN 'reregister' ELSE 'initial' END,
    NULLIF(_reason,''),
    COALESCE(_photo_urls, '{}'),
    (SELECT jsonb_agg(x->'descriptor') FROM jsonb_array_elements(_samples) x),
    'approved', auth.uid(), now(), 'อนุมัติอัตโนมัติ (ผ่าน Liveness)'
  ) RETURNING id INTO _req_id;

  RETURN _req_id;
END;
$$;

REVOKE ALL ON FUNCTION public.self_enroll_face(jsonb, text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.self_enroll_face(jsonb, text[], text) TO authenticated, service_role;

-- ---------- personnel ----------
CREATE OR REPLACE FUNCTION public.self_enroll_personnel_face(_samples jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pid uuid;
  _code text;
  _next int;
  _s jsonb;
  _n int := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'กรุณาเข้าสู่ระบบก่อนลงทะเบียนใบหน้า';
  END IF;

  SELECT id INTO _pid FROM public.personnel WHERE user_id = auth.uid() LIMIT 1;

  IF _pid IS NULL THEN
    SELECT NULLIF(TRIM(employee_code), '') INTO _code FROM public.profiles WHERE id = auth.uid();
    IF _code IS NOT NULL THEN
      SELECT id INTO _pid FROM public.personnel WHERE TRIM(employee_code) = _code LIMIT 1;
      IF _pid IS NOT NULL THEN
        UPDATE public.personnel SET user_id = auth.uid() WHERE id = _pid AND user_id IS NULL;
      END IF;
    END IF;
  END IF;

  IF _pid IS NULL THEN
    RAISE EXCEPTION 'ไม่พบข้อมูลบุคลากรของบัญชีนี้ กรุณาแจ้งผู้ดูแลระบบให้เชื่อมบัญชีกับรหัสบุคลากร';
  END IF;

  IF _samples IS NULL OR jsonb_array_length(_samples) = 0 THEN
    RAISE EXCEPTION 'ไม่มีตัวอย่างใบหน้า';
  END IF;

  SELECT COALESCE(MAX(sample_index) + 1, 0) INTO _next
  FROM public.personnel_face_descriptors WHERE personnel_id = _pid;

  FOR _s IN SELECT * FROM jsonb_array_elements(_samples) LOOP
    INSERT INTO public.personnel_face_descriptors
      (personnel_id, sample_index, descriptor, quality_score, face_image, texture, metrics, captured_by, source)
    VALUES (
      _pid, _next,
      ARRAY(SELECT (jsonb_array_elements_text(_s->'descriptor'))::real),
      NULLIF(_s->>'quality_score','')::real,
      _s->>'face_image',
      CASE WHEN jsonb_typeof(_s->'texture') = 'array'
           THEN ARRAY(SELECT (jsonb_array_elements_text(_s->'texture'))::real) END,
      COALESCE(_s->'metrics', '{}'::jsonb),
      auth.uid(),
      'self_enroll_personnel'
    )
    ON CONFLICT DO NOTHING;
    _next := _next + 1;
    _n := _n + 1;
  END LOOP;

  RETURN _n;
END;
$$;

REVOKE ALL ON FUNCTION public.self_enroll_personnel_face(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.self_enroll_personnel_face(jsonb) TO authenticated, service_role;