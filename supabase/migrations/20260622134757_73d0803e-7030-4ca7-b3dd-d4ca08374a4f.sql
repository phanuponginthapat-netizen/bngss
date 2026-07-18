DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'academic_events','account_balances','action_plans','admissions','assets',
    'attendance','behavior_records','budget_transactions','classrooms','district_snapshots',
    'documents','early_childhood_dev','eforms','enrollments','face_scan_logs',
    'health_measurements','health_records','home_visits','homeroom_records','ict_devices',
    'ict_loans','learning_center_bookings','news_posts','procurement_records','salary_records',
    'schedules','school_lunch_records','school_milk_records','school_test_scores','sdq_records',
    'special_rooms','subjects'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "school_scope_restrictive" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "school_scope_restrictive" ON public.%I
         AS RESTRICTIVE FOR ALL TO authenticated
         USING (school_id IS NULL OR school_id = public.get_user_school_id(auth.uid()))
         WITH CHECK (school_id IS NULL OR school_id = public.get_user_school_id(auth.uid()))',
      t
    );
  END LOOP;
END $$;