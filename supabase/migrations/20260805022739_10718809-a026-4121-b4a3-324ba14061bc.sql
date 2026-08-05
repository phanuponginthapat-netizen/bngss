DO $$
DECLARE t text;
  tables text[] := ARRAY[
    'academic_events','ai_chat_logs','assessment_criteria','asset_damage_reports','assets',
    'attendance','classrooms','cms_menu_items','cms_pages','cms_settings','district_api_keys',
    'document_recipients','documents','eform_attachments','eform_recipients','eforms',
    'enrollments','face_scan_logs','garbage_deposits','garbage_items','garbage_redemptions',
    'garbage_rewards','garbage_student_points','google_chat_webhooks','health_measurements',
    'home_visits','ict_devices','ict_loans','inbox_items','iot_devices','iot_readings',
    'learning_center_bookings','news_posts','notifications','pa_agreements','portfolio_items',
    'pp5_files','pp6_files','profiles','school_settings','special_rooms','students',
    'subject_indicators','subjects','wall_posts','wall_post_comments','wall_post_reactions',
    'chat_messages','chat_conversations','chat_participants','app_secrets','ai_provider_keys',
    'duty_assignments','duty_logs','schedules','emergency_broadcasts'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=t) THEN
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END IF;
  END LOOP;
END $$;