GRANT SELECT ON public.school_settings TO anon;

DROP POLICY IF EXISTS "Anon view public kiosk settings" ON public.school_settings;
DROP POLICY IF EXISTS "Anon view public kiosk settings" ON public.school_settings;
CREATE POLICY "Anon view public kiosk settings"
ON public.school_settings
FOR SELECT
TO anon
USING (
  setting_key IN (
    'kiosk_idle_timeout_sec',
    'kiosk_hello_ai_enabled',
    'kiosk_power_save',
    'kiosk_wake_word_enabled',
    'face_scan_threshold',
    'face_scan_voice',
    'face_scan_cutoff_time',
    'face_scan_mode_cutoff',
    'face_scan_entry_window',
    'face_scan_exit_window'
  )
);

INSERT INTO public.school_settings (setting_key, setting_value)
VALUES
  ('kiosk_hello_ai_enabled', 'true'),
  ('kiosk_wake_word_enabled', 'true')
ON CONFLICT (setting_key) DO UPDATE
SET setting_value = EXCLUDED.setting_value,
    updated_at = now()
WHERE public.school_settings.setting_value IS NULL
   OR public.school_settings.setting_value = '';
