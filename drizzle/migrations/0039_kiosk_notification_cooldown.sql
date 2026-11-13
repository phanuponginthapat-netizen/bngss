CREATE TABLE public.kiosk_notification_cooldowns (notification_key text PRIMARY KEY, claimed_at timestamptz NOT NULL, claim_token uuid NOT NULL);
GRANT ALL ON public.kiosk_notification_cooldowns TO service_role;
ALTER TABLE public.kiosk_notification_cooldowns ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_only ON public.kiosk_notification_cooldowns FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE OR REPLACE FUNCTION public.claim_kiosk_notification(p_key text, p_seconds integer) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE token uuid := gen_random_uuid(); claimed uuid;
BEGIN
IF p_key IS NULL OR length(p_key) > 200 OR p_key NOT LIKE 'kiosk:%' OR p_seconds NOT BETWEEN 60 AND 3600 THEN RAISE EXCEPTION 'invalid kiosk notification claim'; END IF;
INSERT INTO public.kiosk_notification_cooldowns(notification_key,claimed_at,claim_token) VALUES(p_key,clock_timestamp(),token)
ON CONFLICT(notification_key) DO UPDATE SET claimed_at=EXCLUDED.claimed_at,claim_token=EXCLUDED.claim_token WHERE kiosk_notification_cooldowns.claimed_at <= clock_timestamp()-make_interval(secs=>p_seconds)
RETURNING claim_token INTO claimed;
RETURN claimed;
END; $$;
REVOKE ALL ON FUNCTION public.claim_kiosk_notification(text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_kiosk_notification(text,integer) TO service_role;