CREATE OR REPLACE FUNCTION public.is_staff_any(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role IN ('admin','director','teacher'))
      OR EXISTS (SELECT 1 FROM public.personnel WHERE user_id = _uid AND COALESCE(status,'active') = 'active');
$$;

REVOKE EXECUTE ON FUNCTION public.is_staff_any(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_staff_any(uuid) TO authenticated, service_role;

DO $do$
DECLARE
  t text;
  tables text[] := ARRAY[
    'academic_events','academic_periods','account_balances','action_plans','assessment_criteria',
    'asset_damage_reports','assets','attendance','behavior_records','budget_transactions',
    'early_warning_alerts','exam_questions','exam_sheets','exam_submissions','exams',
    'guidance_records','health_measurements','health_records','home_visits','homework_assignments',
    'hub_project_budgets','hub_project_expenses','hub_project_updates','hub_projects','id_plan_records',
    'incomplete_grade_fix_requests','incomplete_grade_reports','mou_records','personnel',
    'procurement_advances','procurement_documents','procurement_records','question_bank',
    'sar_evidences','schedules','sdq_records','staff_leaves','student_assessment_scores',
    'student_column_scores','student_leaves','student_scores','student_screenings','student_subsidies',
    'subject_grading_config','subject_indicators','subject_score_columns','substitute_teaching',
    'teacher_assignments','time_clock','tutoring_bookings','tutoring_sessions','vaccine_records',
    'worksheet_submissions','worksheets'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS "Staff full access" ON public.%I', t);
      EXECUTE format($f$CREATE POLICY "Staff full access" ON public.%I FOR ALL TO authenticated
        USING (public.is_staff_any(auth.uid())) WITH CHECK (public.is_staff_any(auth.uid()))$f$, t);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
      EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    END IF;
  END LOOP;
END
$do$;