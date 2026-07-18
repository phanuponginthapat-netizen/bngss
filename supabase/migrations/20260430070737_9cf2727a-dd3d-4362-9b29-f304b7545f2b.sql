-- Add system_category for IoT classification (water, solar, cctv, hvac, energy, environment, security, access, other)
ALTER TABLE public.iot_devices
  ADD COLUMN IF NOT EXISTS system_category text NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS color text;

CREATE INDEX IF NOT EXISTS idx_iot_devices_system_category ON public.iot_devices(system_category);
CREATE INDEX IF NOT EXISTS idx_iot_readings_device_recorded ON public.iot_readings(device_id, recorded_at DESC);

-- Backfill from dashboard_group when it matches a known category keyword
UPDATE public.iot_devices SET system_category = 'water'
  WHERE system_category = 'other' AND (lower(dashboard_group) LIKE '%water%' OR lower(dashboard_group) LIKE '%ประปา%');
UPDATE public.iot_devices SET system_category = 'solar'
  WHERE system_category = 'other' AND (lower(dashboard_group) LIKE '%solar%' OR lower(dashboard_group) LIKE '%โซลาร์%' OR lower(dashboard_group) LIKE '%โซล่า%');
UPDATE public.iot_devices SET system_category = 'cctv'
  WHERE system_category = 'other' AND (lower(dashboard_group) LIKE '%cctv%' OR lower(dashboard_group) LIKE '%กล้อง%' OR device_type = 'camera');
UPDATE public.iot_devices SET system_category = 'energy'
  WHERE system_category = 'other' AND (lower(dashboard_group) LIKE '%energy%' OR lower(dashboard_group) LIKE '%power%' OR lower(unit) IN ('kwh','w','kw'));
UPDATE public.iot_devices SET system_category = 'environment'
  WHERE system_category = 'other' AND (lower(unit) IN ('°c','%','ppm'));

-- Enable realtime for live charts
ALTER PUBLICATION supabase_realtime ADD TABLE public.iot_readings;