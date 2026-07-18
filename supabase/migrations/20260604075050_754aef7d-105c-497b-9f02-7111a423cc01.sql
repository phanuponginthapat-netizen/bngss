-- Enable realtime broadcast for all core tables
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.inbox_items REPLICA IDENTITY FULL;
ALTER TABLE public.documents REPLICA IDENTITY FULL;
ALTER TABLE public.document_recipients REPLICA IDENTITY FULL;
ALTER TABLE public.eforms REPLICA IDENTITY FULL;
ALTER TABLE public.eform_recipients REPLICA IDENTITY FULL;
ALTER TABLE public.attendance REPLICA IDENTITY FULL;
ALTER TABLE public.behavior_records REPLICA IDENTITY FULL;
ALTER TABLE public.student_leaves REPLICA IDENTITY FULL;
ALTER TABLE public.staff_leaves REPLICA IDENTITY FULL;
ALTER TABLE public.face_scan_logs REPLICA IDENTITY FULL;
ALTER TABLE public.news_posts REPLICA IDENTITY FULL;
ALTER TABLE public.emergency_broadcasts REPLICA IDENTITY FULL;
ALTER TABLE public.academic_events REPLICA IDENTITY FULL;
ALTER TABLE public.students REPLICA IDENTITY FULL;
ALTER TABLE public.classrooms REPLICA IDENTITY FULL;
ALTER TABLE public.personnel REPLICA IDENTITY FULL;
ALTER TABLE public.student_scores REPLICA IDENTITY FULL;
ALTER TABLE public.student_column_scores REPLICA IDENTITY FULL;
ALTER TABLE public.schedules REPLICA IDENTITY FULL;
ALTER TABLE public.homework_assignments REPLICA IDENTITY FULL;
ALTER TABLE public.homeroom_records REPLICA IDENTITY FULL;
ALTER TABLE public.health_records REPLICA IDENTITY FULL;
ALTER TABLE public.home_visits REPLICA IDENTITY FULL;
ALTER TABLE public.sdq_records REPLICA IDENTITY FULL;
ALTER TABLE public.student_screenings REPLICA IDENTITY FULL;
ALTER TABLE public.enrollments REPLICA IDENTITY FULL;
ALTER TABLE public.subjects REPLICA IDENTITY FULL;
ALTER TABLE public.assets REPLICA IDENTITY FULL;
ALTER TABLE public.asset_damage_reports REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.time_clock REPLICA IDENTITY FULL;
ALTER TABLE public.staff_evaluations REPLICA IDENTITY FULL;
ALTER TABLE public.personnel_assessments REPLICA IDENTITY FULL;
ALTER TABLE public.pa_agreements REPLICA IDENTITY FULL;
ALTER TABLE public.id_plan_records REPLICA IDENTITY FULL;
ALTER TABLE public.salary_records REPLICA IDENTITY FULL;
ALTER TABLE public.budget_transactions REPLICA IDENTITY FULL;
ALTER TABLE public.procurement_records REPLICA IDENTITY FULL;
ALTER TABLE public.student_subsidies REPLICA IDENTITY FULL;
ALTER TABLE public.school_lunch_records REPLICA IDENTITY FULL;
ALTER TABLE public.school_milk_records REPLICA IDENTITY FULL;
ALTER TABLE public.action_plans REPLICA IDENTITY FULL;
ALTER TABLE public.user_roles REPLICA IDENTITY FULL;
ALTER TABLE public.school_settings REPLICA IDENTITY FULL;
ALTER TABLE public.cms_settings REPLICA IDENTITY FULL;
ALTER TABLE public.cms_pages REPLICA IDENTITY FULL;
ALTER TABLE public.assessment_criteria REPLICA IDENTITY FULL;
ALTER TABLE public.student_assessment_scores REPLICA IDENTITY FULL;
ALTER TABLE public.subject_score_columns REPLICA IDENTITY FULL;
ALTER TABLE public.early_childhood_dev REPLICA IDENTITY FULL;
ALTER TABLE public.admissions REPLICA IDENTITY FULL;
ALTER TABLE public.substitute_teaching REPLICA IDENTITY FULL;
ALTER TABLE public.pa_indicator_scores REPLICA IDENTITY FULL;
ALTER TABLE public.account_balances REPLICA IDENTITY FULL;
ALTER TABLE public.google_chat_webhooks REPLICA IDENTITY FULL;
ALTER TABLE public.pp5_files REPLICA IDENTITY FULL;
ALTER TABLE public.pp6_files REPLICA IDENTITY FULL;

-- Add all to supabase_realtime publication
DO $$
DECLARE
  t text;
  tbls text[] := ARRAY[
    'notifications','inbox_items','documents','document_recipients',
    'eforms','eform_recipients','attendance','behavior_records',
    'student_leaves','staff_leaves','face_scan_logs','news_posts',
    'emergency_broadcasts','academic_events','students','classrooms',
    'personnel','student_scores','student_column_scores','schedules',
    'homework_assignments','homeroom_records','health_records','home_visits',
    'sdq_records','student_screenings','enrollments','subjects','assets',
    'asset_damage_reports','profiles','time_clock','staff_evaluations',
    'personnel_assessments','pa_agreements','id_plan_records','salary_records',
    'budget_transactions','procurement_records','student_subsidies',
    'school_lunch_records','school_milk_records','action_plans','user_roles',
    'school_settings','cms_settings','cms_pages','assessment_criteria',
    'student_assessment_scores','subject_score_columns','early_childhood_dev',
    'admissions','substitute_teaching','pa_indicator_scores','account_balances',
    'google_chat_webhooks','pp5_files','pp6_files'
  ];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;