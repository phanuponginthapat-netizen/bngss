
-- Add department-position based RLS policies for the 4 main departments
-- Pattern: member+ can SELECT/INSERT/UPDATE; only head (or admin/director) can DELETE
-- These policies are ADDITIVE to existing policies (PostgreSQL combines with OR)

DO $$
DECLARE
  t text;
  dept text;
  academic_tables text[] := ARRAY[
    'student_scores','student_assessment_scores','student_column_scores',
    'subject_score_columns','subject_grading_config','subject_indicators',
    'assessment_criteria','homework_assignments','worksheets','worksheet_submissions',
    'exams','exam_questions','exam_sheets','exam_submissions','question_bank',
    'tutoring_sessions','tutoring_bookings','schedules','teacher_assignments',
    'incomplete_grade_reports','incomplete_grade_fix_requests',
    'academic_events','academic_periods'
  ];
  student_affairs_tables text[] := ARRAY[
    'attendance','behavior_records','student_leaves','sdq_records',
    'guidance_records','home_visits','student_screenings','health_records',
    'health_measurements','early_warning_alerts','vaccine_records'
  ];
  personnel_tables text[] := ARRAY[
    'personnel','personnel_assessments','staff_evaluations','staff_leaves',
    'id_plan_records','salary_records','student_subsidies','time_clock',
    'substitute_teaching'
  ];
  budget_tables text[] := ARRAY[
    'budget_transactions','account_balances','procurement_records',
    'procurement_documents','procurement_advances','assets','asset_damage_reports',
    'action_plans','sar_evidences','mou_records','hub_projects',
    'hub_project_budgets','hub_project_expenses','hub_project_updates'
  ];
  groups text[][] := ARRAY[
    ARRAY['academic'], ARRAY['student_affairs'], ARRAY['personnel'], ARRAY['budget_planning']
  ];
  table_lists text[] := ARRAY[
    array_to_string(academic_tables, ','),
    array_to_string(student_affairs_tables, ','),
    array_to_string(personnel_tables, ','),
    array_to_string(budget_tables, ',')
  ];
  i int;
BEGIN
  FOR i IN 1..array_length(groups,1) LOOP
    dept := groups[i][1];
    FOREACH t IN ARRAY string_to_array(table_lists[i], ',') LOOP
      -- skip if table does not exist
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema='public' AND table_name=t
      ) THEN CONTINUE; END IF;

      -- drop our policies if rerun
      EXECUTE format('DROP POLICY IF EXISTS dept_member_view ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS dept_member_insert ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS dept_member_update ON public.%I', t);
      EXECUTE format('DROP POLICY IF EXISTS dept_head_delete ON public.%I', t);

      EXECUTE format(
        'CREATE POLICY dept_member_view ON public.%I FOR SELECT TO authenticated USING (public.has_dept_position(auth.uid(), %L::school_department, %L::dept_position))',
        t, dept, 'member'
      );
      EXECUTE format(
        'CREATE POLICY dept_member_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (public.has_dept_position(auth.uid(), %L::school_department, %L::dept_position))',
        t, dept, 'member'
      );
      EXECUTE format(
        'CREATE POLICY dept_member_update ON public.%I FOR UPDATE TO authenticated USING (public.has_dept_position(auth.uid(), %L::school_department, %L::dept_position)) WITH CHECK (public.has_dept_position(auth.uid(), %L::school_department, %L::dept_position))',
        t, dept, 'member', dept, 'member'
      );
      EXECUTE format(
        'CREATE POLICY dept_head_delete ON public.%I FOR DELETE TO authenticated USING (public.has_dept_position(auth.uid(), %L::school_department, %L::dept_position))',
        t, dept, 'head'
      );
    END LOOP;
  END LOOP;
END $$;
