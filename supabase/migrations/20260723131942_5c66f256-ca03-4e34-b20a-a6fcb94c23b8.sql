
DO $$
DECLARE
  tbls text[] := ARRAY[
    'activity_participants','activity_scores','ai_provider_keys','ai_usage_logs',
    'alumni_university','archive_logs','audit_logs','cctv_cameras','chat_reports',
    'club_applications','club_attendance','club_feed_posts','config_bundles',
    'district_api_keys','district_feed_logs','district_snapshots','document_recipients',
    'error_logs','fitness_points_ledger','fitness_redemptions','fitness_user_achievements',
    'form_submissions','game_hub_api_keys','google_chat_logs','google_chat_webhooks',
    'import_mapping_memory','line_richmenu_state','line_vault_drive_trash',
    'notification_delivery_log','pdpa_requests','promotion_runs','rate_limit_logs',
    'saraban_documents','student_enrollment_history','upstream_subscription','visitor_logs',
    'ai_providers','app_secrets','district_snapshot_runs','district_feed_outbox',
    'ai_chat_logs','browser_logs','line_sessions'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
               WHERE n.nspname='public' AND c.relname=t) THEN
      EXECUTE format('DROP POLICY IF EXISTS "admin manage %I" ON public.%I', t, t);
      EXECUTE format(
        'CREATE POLICY "admin manage %I" ON public.%I FOR ALL TO authenticated '||
        'USING (public.has_role(auth.uid(),''admin'') OR public.has_role(auth.uid(),''director'')) '||
        'WITH CHECK (public.has_role(auth.uid(),''admin'') OR public.has_role(auth.uid(),''director''))',
        t, t
      );
    END IF;
  END LOOP;
END $$;
