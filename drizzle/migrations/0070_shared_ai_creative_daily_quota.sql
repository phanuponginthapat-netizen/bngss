ALTER TABLE public.ai_image_generations ADD COLUMN work_kind text NOT NULL DEFAULT 'image';
ALTER TABLE public.ai_image_generations ADD CONSTRAINT ai_creative_work_kind CHECK (work_kind IN ('image','worksheet','lesson','quiz','document'));
CREATE OR REPLACE FUNCTION public.claim_ai_creative_slot(_user_id uuid, _prompt text, _kind text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _used integer; _id uuid; _start timestamptz := date_trunc('day', now() AT TIME ZONE 'Asia/Bangkok') AT TIME ZONE 'Asia/Bangkok';
BEGIN
  IF _user_id IS NULL OR _prompt IS NULL OR length(trim(_prompt)) = 0 OR length(_prompt) > 2000 OR _kind IS NULL OR _kind NOT IN ('image','worksheet','lesson','quiz','document') THEN RAISE EXCEPTION 'Invalid creative request'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role::text IN ('admin','director','teacher','student','parent','alumni','observer')) THEN RAISE EXCEPTION 'School role required' USING ERRCODE = '42501'; END IF;
  IF _kind IN ('worksheet','lesson','document') AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role::text IN ('admin','director','teacher')) THEN RAISE EXCEPTION 'Staff role required' USING ERRCODE = '42501'; END IF;
  IF _kind = 'quiz' AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role::text IN ('admin','director','teacher','student')) THEN RAISE EXCEPTION 'Quiz role required' USING ERRCODE = '42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('ai_image:' || _user_id::text));
  SELECT count(*) INTO _used FROM public.ai_image_generations WHERE user_id = _user_id AND created_at >= _start;
  IF _used >= 5 THEN RETURN NULL; END IF;
  INSERT INTO public.ai_image_generations (user_id,prompt,work_kind) VALUES (_user_id,_prompt,_kind) RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.claim_ai_creative_slot(uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ai_creative_slot(uuid,text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.claim_ai_image_slot(_user_id uuid, _prompt text, _limit integer, _day_start timestamptz)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT public.claim_ai_creative_slot(_user_id,_prompt,'image'); $$;
REVOKE ALL ON FUNCTION public.claim_ai_image_slot(uuid,text,integer,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ai_image_slot(uuid,text,integer,timestamptz) TO service_role;