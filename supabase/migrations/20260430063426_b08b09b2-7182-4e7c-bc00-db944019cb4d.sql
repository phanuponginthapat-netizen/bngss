
-- IoT Devices table
CREATE TABLE IF NOT EXISTS public.iot_devices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  device_type TEXT NOT NULL DEFAULT 'sensor', -- sensor, switch, camera, gauge, binary
  icon TEXT DEFAULT 'Activity',
  unit TEXT, -- °C, %, kWh, ppm, etc.
  source_type TEXT NOT NULL DEFAULT 'home_assistant', -- home_assistant, generic_rest, mqtt, webhook
  base_url TEXT, -- e.g. http://homeassistant.local:8123
  entity_id TEXT, -- e.g. sensor.living_room_temperature
  api_token TEXT, -- bearer token / long-lived access token (consider moving to vault later)
  request_path TEXT, -- for generic_rest: e.g. /api/states/sensor.x
  json_path TEXT, -- e.g. $.state or $.data.value
  poll_interval_seconds INT NOT NULL DEFAULT 60,
  location TEXT,
  dashboard_group TEXT DEFAULT 'general', -- group on dashboard
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_value TEXT,
  last_value_numeric NUMERIC,
  last_status TEXT, -- online, offline, error
  last_error TEXT,
  last_fetched_at TIMESTAMPTZ,
  meta JSONB DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_iot_devices_active ON public.iot_devices(is_active);
CREATE INDEX IF NOT EXISTS idx_iot_devices_group ON public.iot_devices(dashboard_group);

ALTER TABLE public.iot_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view iot devices"
ON public.iot_devices FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can insert iot devices"
ON public.iot_devices FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

CREATE POLICY "Admins can update iot devices"
ON public.iot_devices FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director') OR public.has_role(auth.uid(), 'teacher'));

CREATE POLICY "Admins can delete iot devices"
ON public.iot_devices FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

CREATE TRIGGER trg_iot_devices_updated
BEFORE UPDATE ON public.iot_devices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- IoT Readings (time-series)
CREATE TABLE IF NOT EXISTS public.iot_readings (
  id BIGSERIAL PRIMARY KEY,
  device_id UUID NOT NULL REFERENCES public.iot_devices(id) ON DELETE CASCADE,
  value TEXT,
  value_numeric NUMERIC,
  status TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_iot_readings_device_time ON public.iot_readings(device_id, recorded_at DESC);

ALTER TABLE public.iot_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view iot readings"
ON public.iot_readings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admin/teacher can insert iot readings"
ON public.iot_readings FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'director')
  OR public.has_role(auth.uid(), 'teacher')
);

CREATE POLICY "Admins can delete iot readings"
ON public.iot_readings FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));
