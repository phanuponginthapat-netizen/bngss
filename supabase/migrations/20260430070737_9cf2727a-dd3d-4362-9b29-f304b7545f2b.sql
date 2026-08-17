-- Add system_category for IoT classification (water, solar, cctv, hvac, energy, environment, security, access, other)
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.iot_devices
  ADD COLUMN IF NOT EXISTS system_category text NOT NULL DEFAULT ''other'',
  ADD COLUMN IF NOT EXISTS color text';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $idxguard$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_iot_devices_system_category ON public.iot_devices(system_category)';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
DO $idxguard$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_iot_readings_device_recorded ON public.iot_readings(device_id, recorded_at DESC)';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
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
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'iot_readings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.iot_readings;
  END IF;
END $$;
