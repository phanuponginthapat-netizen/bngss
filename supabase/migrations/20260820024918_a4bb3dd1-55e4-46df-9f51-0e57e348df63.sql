DROP POLICY IF EXISTS "Authenticated read allowed settings" ON public.school_settings;

CREATE POLICY "Authenticated read allowed settings"
ON public.school_settings FOR SELECT TO authenticated
USING (
  public.is_staff_user(auth.uid())
  OR setting_key = ('first_login_done_' || auth.uid()::text)
  OR setting_key = ANY (ARRAY[
    'social_media_links','disabled_modules','kiosk_idle_timeout_sec','kiosk_hello_ai_enabled',
    'kiosk_power_save','kiosk_wake_word_enabled','face_scan_threshold','face_scan_voice',
    'face_scan_cutoff_time','face_scan_mode_cutoff','face_scan_entry_window','face_scan_exit_window'
  ])
  OR setting_key LIKE 'cms\_%'
  OR setting_key LIKE 'school\_%'
  OR setting_key LIKE 'theme\_%'
  OR setting_key LIKE 'module\_%'
  OR setting_key LIKE 'feature\_%'
  OR setting_key LIKE 'academic\_%'
  OR setting_key LIKE 'app\_%'
);