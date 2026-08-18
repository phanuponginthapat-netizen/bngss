CREATE TABLE IF NOT EXISTS public.kiosk_health_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL,
  kiosk_mode text,
  status text,
  uptime_sec integer,
  battery_percent numeric,
  battery_charging boolean,
  battery_status text,
  memory_used_mb numeric,
  latency_ms integer,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  sampled_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kiosk_health_samples_dev_time ON public.kiosk_health_samples(device_id, sampled_at DESC);
CREATE INDEX IF NOT EXISTS idx_kiosk_health_samples_mode_time ON public.kiosk_health_samples(kiosk_mode, sampled_at DESC);

GRANT SELECT, INSERT ON public.kiosk_health_samples TO authenticated;
GRANT ALL ON public.kiosk_health_samples TO service_role;

ALTER TABLE public.kiosk_health_samples ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.kiosk_health_samples'::regclass AND polname='kiosk health insert authenticated') THEN
    CREATE POLICY "kiosk health insert authenticated" ON public.kiosk_health_samples FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.kiosk_health_samples'::regclass AND polname='kiosk health read authenticated') THEN
    CREATE POLICY "kiosk health read authenticated" ON public.kiosk_health_samples FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.kiosk_heartbeat(
  _device_id text,
  _hostname text DEFAULT NULL,
  _user_agent text DEFAULT NULL,
  _status text DEFAULT 'online',
  _kiosk_mode text DEFAULT NULL,
  _config_updated_at timestamptz DEFAULT NULL,
  _uptime_sec integer DEFAULT 0,
  _screen_resolution text DEFAULT NULL,
  _extension_installed boolean DEFAULT false
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _device_id IS NULL OR length(trim(_device_id)) = 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.kiosk_devices AS k (
    device_id, user_id, hostname, user_agent, status, kiosk_mode,
    config_updated_at, uptime_sec, screen_resolution, extension_installed, last_seen_at
  ) VALUES (
    _device_id, auth.uid(), _hostname, _user_agent, _status, _kiosk_mode,
    _config_updated_at, _uptime_sec, _screen_resolution, _extension_installed, now()
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
    last_seen_at = now(),
    updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.kiosk_heartbeat(text,text,text,text,text,timestamptz,integer,text,boolean) TO authenticated, anon;