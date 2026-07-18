DO $$
DECLARE
  t text;
  excluded text[] := ARRAY[
    'app_secrets','ai_provider_keys','ai_chat_logs','ai_user_memory',
    'webauthn_credentials','webauthn_challenges','mfa_settings',
    'student_face_descriptors','face_registration_history','face_registration_requests','face_scan_logs',
    'district_api_keys','district_feed_logs','district_snapshots',
    'push_subscriptions','line_sessions','line_user_preferences',
    'rate_limit_logs','error_logs','audit_logs',
    'google_chat_webhooks','google_chat_logs','notification_delivery_log',
    'pdpa_consents','pdpa_requests','salary_records','tuition_invoices',
    'health_records','health_measurements','vaccine_records','sdq_records',
    'guidance_records','home_visits','student_screenings','behavior_records',
    'user_roles','user_departments','config_bundles','import_mapping_memory',
    'ai_usage_logs','ai_providers','mascot_advice_cache','iot_readings','iot_devices',
    'cctv_cameras','visitor_logs'
  ];
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    IF NOT (t = ANY(excluded)) THEN
      EXECUTE format('DROP POLICY IF EXISTS "Observers can view" ON public.%I;', t);
      EXECUTE format(
        'CREATE POLICY "Observers can view" ON public.%I FOR SELECT TO authenticated USING (public.has_role(auth.uid(), ''observer''::public.app_role));',
        t
      );
    END IF;
  END LOOP;
END$$;

DROP POLICY IF EXISTS "Observers can read own role" ON public.user_roles;
CREATE POLICY "Observers can read own role" ON public.user_roles
FOR SELECT TO authenticated
USING (user_id = auth.uid());