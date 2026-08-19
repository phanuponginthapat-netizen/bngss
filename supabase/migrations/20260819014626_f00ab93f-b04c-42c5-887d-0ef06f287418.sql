ALTER TABLE public.student_face_descriptors ADD COLUMN IF NOT EXISTS texture real[];

CREATE OR REPLACE FUNCTION public.approve_face_request(
  _request_id uuid,
  _samples jsonb,
  _photo_urls text[] DEFAULT NULL,
  _reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _student_id uuid;
  _request_type text;
  _requested_by uuid;
  _prev_count int;
  _start int;
  _s jsonb;
  _new_count int;
  _history_id uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director')) THEN
    RAISE EXCEPTION 'ไม่มีสิทธิ์อนุมัติคำขอ';
  END IF;

  SELECT student_id, request_type, requested_by INTO _student_id, _request_type, _requested_by
  FROM public.face_registration_requests WHERE id = _request_id;
  IF _student_id IS NULL THEN
    RAISE EXCEPTION 'ไม่พบคำขอใบหน้าที่เลือก';
  END IF;

  SELECT COUNT(*) INTO _prev_count FROM public.student_face_descriptors WHERE student_id = _student_id;

  IF _request_type = 'reregister' THEN
    DELETE FROM public.student_face_descriptors WHERE student_id = _student_id;
    _start := 0;
  ELSE
    SELECT COALESCE(MAX(sample_index) + 1, 0) INTO _start FROM public.student_face_descriptors WHERE student_id = _student_id;
  END IF;

  FOR _s IN SELECT * FROM jsonb_array_elements(_samples) LOOP
    INSERT INTO public.student_face_descriptors
      (student_id, sample_index, descriptor, captured_by, source, face_image, texture)
    VALUES (
      _student_id,
      _start,
      ARRAY(SELECT (jsonb_array_elements_text(_s->'descriptor'))::real),
      COALESCE(_requested_by, auth.uid()),
      'request_approved',
      _s->>'face_image',
      CASE WHEN _s ? 'texture' AND _s->'texture' != 'null'
        THEN ARRAY(SELECT (jsonb_array_elements_text(_s->'texture'))::real)
        ELSE NULL END
    );
    _start := _start + 1;
  END LOOP;

  UPDATE public.face_registration_requests
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = _request_id;

  SELECT COUNT(*) INTO _new_count FROM public.student_face_descriptors WHERE student_id = _student_id;

  INSERT INTO public.face_registration_history
    (student_id, request_id, action, previous_count, new_count, photo_urls, reason, notes, performed_by)
  VALUES (
    _student_id, _request_id,
    CASE WHEN _request_type = 'reregister' THEN 'reregistered' ELSE 'registered' END,
    _prev_count, _new_count,
    _photo_urls, _reason,
    'อนุมัติคำขอ ' || CASE WHEN _request_type = 'reregister' THEN 'ลงทะเบียนใหม่' ELSE 'ลงทะเบียนครั้งแรก' END,
    auth.uid()
  ) RETURNING id INTO _history_id;

  RETURN _history_id;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_face_request(uuid, jsonb, text[], text) FROM public;
GRANT EXECUTE ON FUNCTION public.approve_face_request(uuid, jsonb, text[], text) TO authenticated;