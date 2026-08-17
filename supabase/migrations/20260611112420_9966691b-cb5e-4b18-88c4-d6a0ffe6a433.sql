-- Add critical user-facing tables to realtime publication (P0 per memory rule)
-- These were silently missing → users had to refresh to see updates.

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'profiles','personnel','students','user_roles','user_departments',
    'ict_loans','ict_devices',
    'garbage_deposits','garbage_redemptions','garbage_student_points',
    'garbage_personnel_points','garbage_user_badges','garbage_badges',
    'pa_agreements','pa_indicator_scores',
    'staff_evaluations','personnel_assessments',
    'face_registration_requests','student_face_descriptors','face_registration_history',
    'time_clock',
    'ai_chat_logs',
    'audit_logs',
    'pdpa_consents',
    'procurement_records','budget_transactions','salary_records','account_balances',
    'student_subsidies','student_column_scores','subject_indicators',
    'teacher_assignments','user_dashboard_widgets',
    'cms_menu_items',
    'iot_devices','iot_readings',
    'exam_questions','exam_sheets'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- only add if exists and not already in publication
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
               WHERE n.nspname='public' AND c.relname=t AND c.relkind='r')
       AND NOT EXISTS (SELECT 1 FROM pg_publication_tables
                       WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t)
    THEN
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
