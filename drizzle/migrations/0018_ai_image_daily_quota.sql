CREATE TABLE public.ai_image_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  prompt text NOT NULL,
  storage_path text,
  drive_file_id text,
  drive_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_image_generations_user_day ON public.ai_image_generations (user_id, created_at DESC);
GRANT SELECT ON public.ai_image_generations TO authenticated;
GRANT ALL ON public.ai_image_generations TO service_role;
ALTER TABLE public.ai_image_generations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own image generations" ON public.ai_image_generations
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.claim_ai_image_slot(_user_id uuid, _prompt text, _limit integer, _day_start timestamptz)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _used integer; _id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('ai_image:' || _user_id::text));
  SELECT count(*) INTO _used FROM public.ai_image_generations WHERE user_id = _user_id AND created_at >= _day_start;
  IF _used >= _limit THEN RETURN NULL; END IF;
  INSERT INTO public.ai_image_generations (user_id, prompt) VALUES (_user_id, left(_prompt, 2000)) RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.claim_ai_image_slot(uuid, text, integer, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ai_image_slot(uuid, text, integer, timestamptz) TO service_role;