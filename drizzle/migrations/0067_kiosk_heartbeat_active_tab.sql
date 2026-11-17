CREATE OR REPLACE FUNCTION public.kiosk_heartbeat(
  _device_id text,
  _hostname text DEFAULT NULL,
  _user_agent text DEFAULT NULL,
  _status text DEFAULT 'online',
  _kiosk_mode text DEFAULT NULL,
  _config_updated_at timestamptz DEFAULT NULL,
  _uptime_sec integer DEFAULT 0,
  _screen_resolution text DEFAULT NULL,
  _extension_installed boolean DEFAULT false,
  _extension_version text DEFAULT NULL,
  _agent_version text DEFAULT NULL,
  _active_title text DEFAULT NULL,
  _active_url text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _device_id IS NULL OR length(trim(_device_id)) = 0 THEN RETURN; END IF;
  INSERT INTO public.kiosk_devices AS k (
    device_id, user_id, hostname, user_agent, status, kiosk_mode, config_updated_at, uptime_sec,
    screen_resolution, extension_installed, extension_version, agent_version, last_seen_at, meta
  ) VALUES (
    _device_id, auth.uid(), _hostname, _user_agent, _status, _kiosk_mode, _config_updated_at, _uptime_sec,
    _screen_resolution, _extension_installed, left(_extension_version, 20), left(_agent_version, 20), now(),
    CASE WHEN _active_url IS NOT NULL AND _active_url <> '' THEN
      jsonb_build_object('active_tab', jsonb_build_object('title', left(COALESCE(_active_title, ''), 200), 'url', left(_active_url, 500), 'at', now())
    ) ELSE '{}'::jsonb END
  )
  ON CONFLICT (device_id) DO UPDATE SET
    user_id = COALESCE(auth.uid(), k.user_id),
    hostname = COALESCE(EXCLUDED.hostname, k.hostname),
    user_agent = COALESCE(EXCLUDED.user_agent, k.user_agent),
    status = EXCLUDED.status,
    kiosk_mode = COALESCE(EXCLUDED.kiosk_mode, k.kiosk_mode),
    config_updated_at = COALESCE(EXCLUDED.config_updated_at, k.config_updated_at),
    uptime_sec = EXCLUDED.uptime_sec,
    screen_resolution = COALESCE(EXCLUDED.screen_resolution, k.screen_resolution),
    extension_installed = EXCLUDED.extension_installed,
    extension_version = CASE WHEN EXCLUDED.extension_installed THEN COALESCE(EXCLUDED.extension_version, k.extension_version) ELSE NULL END,
    agent_version = CASE WHEN k.device_key IS NULL OR k.device_key = '' THEN EXCLUDED.agent_version ELSE k.agent_version END,
    meta = CASE WHEN EXCLUDED.meta ? 'active_tab' THEN COALESCE(k.meta, '{}'::jsonb) - 'active_tab' || EXCLUDED.meta ELSE COALESCE(k.meta, '{}'::jsonb) END,
    last_seen_at = now(),
    updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.kiosk_heartbeat(text,text,text,text,text,timestamptz,integer,text,boolean,text,text,text,text) TO authenticated, anon;