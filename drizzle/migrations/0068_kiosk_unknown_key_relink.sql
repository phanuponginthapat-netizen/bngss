DROP FUNCTION IF EXISTS public.kiosk_heartbeat(text,text,text,text,text,timestamptz,integer,text,boolean,text,text);

CREATE TABLE public.kiosk_unknown_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_key text NOT NULL UNIQUE,
  key_hint text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  hits integer NOT NULL DEFAULT 1,
  last_route text,
  ip_address text,
  user_agent text,
  platform text,
  agent_version text
);

GRANT ALL ON public.kiosk_unknown_keys TO service_role;
GRANT SELECT (id, key_hint, first_seen_at, last_seen_at, hits, last_route, ip_address, user_agent, platform, agent_version) ON public.kiosk_unknown_keys TO authenticated;
GRANT DELETE ON public.kiosk_unknown_keys TO authenticated;

ALTER TABLE public.kiosk_unknown_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins view unknown kiosk keys" ON public.kiosk_unknown_keys
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

CREATE POLICY "admins dismiss unknown kiosk keys" ON public.kiosk_unknown_keys
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

-- Called only by kiosk-api (service role) when a request carries a key that matches no device.
CREATE OR REPLACE FUNCTION public.record_kiosk_unknown_key(
  _key text, _route text, _ip text, _user_agent text, _platform text, _agent_version text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _key IS NULL OR length(_key) < 16 OR length(_key) > 128 OR _key !~ '^[A-Za-z0-9_-]+$' THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.kiosk_devices WHERE device_key = _key) THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.kiosk_unknown_keys WHERE device_key = _key)
     AND (SELECT count(*) FROM public.kiosk_unknown_keys) >= 200 THEN RETURN; END IF;
  INSERT INTO public.kiosk_unknown_keys AS u (device_key, key_hint, last_route, ip_address, user_agent, platform, agent_version)
  VALUES (_key, left(_key, 4) || '…' || right(_key, 4), left(_route, 60), left(_ip, 64), left(_user_agent, 200), left(_platform, 80), left(_agent_version, 20))
  ON CONFLICT (device_key) DO UPDATE SET
    last_seen_at = now(),
    hits = u.hits + 1,
    last_route = COALESCE(EXCLUDED.last_route, u.last_route),
    ip_address = COALESCE(EXCLUDED.ip_address, u.ip_address),
    user_agent = COALESCE(EXCLUDED.user_agent, u.user_agent),
    platform = COALESCE(EXCLUDED.platform, u.platform),
    agent_version = COALESCE(EXCLUDED.agent_version, u.agent_version);
END;
$$;
REVOKE ALL ON FUNCTION public.record_kiosk_unknown_key(text,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_kiosk_unknown_key(text,text,text,text,text,text) TO service_role;

-- Admin/director re-links a known-but-missing scanner, reusing the key already stored on that machine.
CREATE OR REPLACE FUNCTION public.approve_kiosk_unknown_key(_id uuid, _name text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.kiosk_unknown_keys%ROWTYPE; new_id text;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director')) THEN
    RAISE EXCEPTION 'ต้องเป็นผู้ดูแลระบบหรือผู้บริหาร' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO r FROM public.kiosk_unknown_keys WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ไม่พบรายการเครื่องนี้แล้ว'; END IF;
  IF EXISTS (SELECT 1 FROM public.kiosk_devices WHERE device_key = r.device_key) THEN
    DELETE FROM public.kiosk_unknown_keys WHERE id = _id;
    RAISE EXCEPTION 'เครื่องนี้อยู่ในระบบแล้ว';
  END IF;
  new_id := 'kiosk-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
  INSERT INTO public.kiosk_devices (device_id, device_key, name, default_direction, is_active, status, platform, agent_version, user_id, ip_address, last_seen_at)
  VALUES (new_id, r.device_key, COALESCE(NULLIF(trim(left(_name, 60)), ''), 'ตู้สแกน ' || r.key_hint), 'in', true, 'offline', r.platform, r.agent_version, auth.uid(), r.ip_address, r.last_seen_at);
  DELETE FROM public.kiosk_unknown_keys WHERE id = _id;
  RETURN new_id;
END;
$$;
REVOKE ALL ON FUNCTION public.approve_kiosk_unknown_key(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_kiosk_unknown_key(uuid,text) TO authenticated;