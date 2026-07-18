
-- Storage: restrict asset-photos SELECT to staff + observers
DROP POLICY IF EXISTS "Authenticated can read asset photos" ON storage.objects;
CREATE POLICY "Staff read asset photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'asset-photos'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'director'::app_role)
    OR has_role(auth.uid(), 'teacher'::app_role)
    OR has_role(auth.uid(), 'observer'::app_role)
  )
);

-- school_settings: allowlist safe keys instead of blocklist
DROP POLICY IF EXISTS "Authenticated view non-sensitive school_settings" ON public.school_settings;

CREATE POLICY "Authenticated view safe school_settings"
ON public.school_settings
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'director'::app_role)
  OR setting_key IN (
    'activity_locks',
    'behavior_starting_points',
    'clock_in_start','clock_in_end','clock_out_start','clock_out_end',
    'clock_late_threshold','clock_latitude','clock_longitude','clock_radius',
    'gps_enforcement_enabled',
    'disabled_modules',
    'email_domain',
    'face_scan_cutoff_time','face_scan_entry_window','face_scan_exit_window',
    'face_scan_mode_cutoff','face_scan_threshold',
    'fb_page_url','tiktok_channel_url','youtube_channel_url',
    'grade_range_start','grade_range_end','terminal_grades','split_levels_schedule',
    'line_auto_push_enabled','line_bot_enabled','line_notify_enabled','line_oa_basic_id',
    'primary_lunch_after_period','primary_lunch_duration_min',
    'primary_period_duration_min','primary_period_start_time',
    'primary_period_times_json','primary_periods_per_day',
    'secondary_lunch_after_period','secondary_lunch_duration_min',
    'secondary_period_duration_min','secondary_period_start_time',
    'secondary_period_times_json','secondary_periods_per_day',
    'weekend_days_json','weekend_schedule_enabled'
  )
  OR setting_key LIKE 'first_login_done_%'
  OR setting_key LIKE 'incomplete_grade_window_%'
);
