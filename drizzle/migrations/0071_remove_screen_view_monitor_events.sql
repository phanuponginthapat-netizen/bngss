DELETE FROM public.monitor_event_receipts WHERE event->>'type' IN ('request-stream','stop-stream','offer','answer','ice') OR event->>'action'='screenshot';

CREATE OR REPLACE FUNCTION public.issue_monitor_event(_event jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); privileged boolean; target text; kind text; event_id uuid;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
 SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=uid AND role::text IN ('admin','director','teacher')) INTO privileged;
 target := _event->>'to'; kind := _event->>'type';
 IF target IS NULL OR kind NOT IN ('command','command-error','screenshot-image','force-logout') OR octet_length(_event::text)>8000 THEN RAISE EXCEPTION 'Invalid event'; END IF;
 IF kind IN ('command-error','screenshot-image') THEN
   IF COALESCE(_event->>'image','') <> '' THEN RAISE EXCEPTION 'Invalid event'; END IF;
   _event := (_event - 'image') || jsonb_build_object('type','command-error');
   kind := 'command-error';
 END IF;
 IF kind IN ('command','force-logout') AND NOT privileged THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF kind='command' AND COALESCE(_event->>'action','') NOT IN ('lock','unlock','message','open-url','shutdown','reboot','logout') THEN RAISE EXCEPTION 'Invalid command'; END IF;
 IF kind='command' AND _event->>'action'='open-url' AND COALESCE(_event#>>'{payload,url}','') !~ '^https?://' THEN RAISE EXCEPTION 'Invalid URL'; END IF;
 IF target <> '*' THEN
   IF target !~ '^[0-9a-fA-F-]{36}$' THEN RAISE EXCEPTION 'Invalid recipient'; END IF;
   IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=target::uuid AND role::text IN ('student','teacher','parent','admin','director')) THEN RAISE EXCEPTION 'Invalid recipient'; END IF;
   IF NOT privileged AND NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=target::uuid AND role::text IN ('admin','director','teacher')) THEN RAISE EXCEPTION 'Forbidden recipient'; END IF;
 ELSIF NOT privileged THEN RAISE EXCEPTION 'Forbidden broadcast'; END IF;
 DELETE FROM public.monitor_event_receipts WHERE expires_at < now();
 INSERT INTO public.monitor_event_receipts(issuer_id,recipient,event) VALUES(uid,target,jsonb_set(_event,'{from}',to_jsonb(uid::text))) RETURNING id INTO event_id;
 RETURN event_id;
END $$;
REVOKE ALL ON FUNCTION public.issue_monitor_event(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.issue_monitor_event(jsonb) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.read_monitor_event(_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); r public.monitor_event_receipts;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
 SELECT * INTO r FROM public.monitor_event_receipts WHERE id=_id AND expires_at>now();
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF r.event->>'type' NOT IN ('command','command-error','force-logout') THEN RETURN NULL; END IF;
 IF r.recipient <> uid::text AND r.recipient <> '*' THEN RETURN NULL; END IF;
 IF r.recipient='*' AND NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=uid AND role::text='student') THEN RETURN NULL; END IF;
 RETURN r.event;
END $$;
REVOKE ALL ON FUNCTION public.read_monitor_event(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.read_monitor_event(uuid) TO authenticated,service_role;