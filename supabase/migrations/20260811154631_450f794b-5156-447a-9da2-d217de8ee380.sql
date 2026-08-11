DO $$
DECLARE
  probe jsonb;
  cnt int;
BEGIN
  SELECT jsonb_build_array(to_jsonb(d.descriptor))
    INTO probe
  FROM public.student_face_descriptors d
  WHERE array_length(d.descriptor, 1) = 128
  LIMIT 1;

  IF probe IS NULL THEN
    RAISE NOTICE 'no descriptors to test against';
    RETURN;
  END IF;

  SELECT count(*) INTO cnt FROM public.check_face_duplicate(NULL, probe, 0.42);
  RAISE NOTICE 'self-probe duplicate matches: %', cnt;

  IF cnt <> 1 THEN
    RAISE EXCEPTION 'check_face_duplicate smoke test failed (expected 1 match, got %)', cnt;
  END IF;
END $$;