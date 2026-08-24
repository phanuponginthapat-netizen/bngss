CREATE OR REPLACE FUNCTION public.get_my_face_identity()
RETURNS TABLE (
  kind text,
  person_id uuid,
  code text,
  prefix text,
  first_name text,
  last_name text,
  photo_url text,
  classroom_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text;
  _sid uuid;
  _pid uuid;
  _code text;
  _fn text;
  _ln text;
  _cnt int;
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;

  SELECT u.email INTO _email FROM auth.users u WHERE u.id = _uid;
  SELECT NULLIF(TRIM(p.student_code),''), p.first_name, p.last_name
    INTO _code, _fn, _ln
  FROM public.profiles p WHERE p.id = _uid;

  SELECT s.id INTO _sid FROM public.students s WHERE s.auth_user_id = _uid LIMIT 1;

  IF _sid IS NULL AND _code IS NOT NULL THEN
    SELECT s.id INTO _sid FROM public.students s WHERE TRIM(s.student_code) = _code LIMIT 1;
  END IF;

  IF _sid IS NULL AND _email IS NOT NULL THEN
    SELECT s.id INTO _sid FROM public.students s
    WHERE LOWER(TRIM(s.auth_email)) = LOWER(TRIM(_email)) LIMIT 1;
  END IF;

  IF _sid IS NULL AND _fn IS NOT NULL AND _ln IS NOT NULL THEN
    SELECT COUNT(*) INTO _cnt FROM public.students s
    WHERE TRIM(s.first_name) = TRIM(_fn) AND TRIM(s.last_name) = TRIM(_ln) AND s.status = 'active';
    IF _cnt = 1 THEN
      SELECT s.id INTO _sid FROM public.students s
      WHERE TRIM(s.first_name) = TRIM(_fn) AND TRIM(s.last_name) = TRIM(_ln) AND s.status = 'active'
      LIMIT 1;
    END IF;
  END IF;

  IF _sid IS NOT NULL THEN
    RETURN QUERY
    SELECT 'student'::text, s.id, s.student_code, s.prefix, s.first_name, s.last_name,
           s.photo_url, c.name
    FROM public.students s
    LEFT JOIN public.classrooms c ON c.id = s.classroom_id
    WHERE s.id = _sid;
    RETURN;
  END IF;

  SELECT pe.id INTO _pid FROM public.personnel pe WHERE pe.user_id = _uid LIMIT 1;
  IF _pid IS NULL THEN
    SELECT NULLIF(TRIM(p.employee_code),'') INTO _code FROM public.profiles p WHERE p.id = _uid;
    IF _code IS NOT NULL THEN
      SELECT pe.id INTO _pid FROM public.personnel pe WHERE TRIM(pe.employee_code) = _code LIMIT 1;
    END IF;
  END IF;
  IF _pid IS NULL AND _email IS NOT NULL THEN
    SELECT pe.id INTO _pid FROM public.personnel pe
    WHERE LOWER(TRIM(pe.email)) = LOWER(TRIM(_email)) LIMIT 1;
  END IF;

  IF _pid IS NOT NULL THEN
    RETURN QUERY
    SELECT 'personnel'::text, pe.id, pe.employee_code, pe.prefix, pe.first_name, pe.last_name,
           (SELECT pr.avatar_url FROM public.profiles pr WHERE pr.id = pe.user_id), NULL::text
    FROM public.personnel pe WHERE pe.id = _pid;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_face_identity() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_face_identity() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.link_my_identity()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r record; _found boolean := false;
BEGIN
  FOR r IN SELECT * FROM public.get_my_face_identity() LIMIT 1 LOOP
    _found := true;
    IF r.kind = 'student' THEN
      UPDATE public.students SET auth_user_id = auth.uid()
        WHERE id = r.person_id AND auth_user_id IS NULL;
      UPDATE public.profiles SET student_code = COALESCE(NULLIF(TRIM(student_code),''), r.code)
        WHERE id = auth.uid();
    ELSE
      UPDATE public.personnel SET user_id = auth.uid()
        WHERE id = r.person_id AND user_id IS NULL;
    END IF;
    RETURN r.kind;
  END LOOP;
  RETURN 'none';
END;
$$;

REVOKE ALL ON FUNCTION public.link_my_identity() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_my_identity() TO authenticated, service_role;

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
  _r record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'กรุณาเข้าสู่ระบบก่อนลงทะเบียนใบหน้า';
  END IF;

  FOR _r IN SELECT * FROM public.get_my_face_identity() LIMIT 1 LOOP
    IF _r.kind = 'student' THEN
      _student_id := _r.person_id;
      UPDATE public.students SET auth_user_id = auth.uid()
        WHERE id = _student_id AND auth_user_id IS NULL;
    END IF;
  END LOOP;

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

REVOKE ALL ON FUNCTION public.self_enroll_face(jsonb, text[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.self_enroll_face(jsonb, text[], text) TO authenticated, service_role;