CREATE OR REPLACE FUNCTION public.auto_fill_school_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.school_id IS NULL THEN
    NEW.school_id := public.get_user_school_id(auth.uid());
    IF NEW.school_id IS NULL THEN
      SELECT id INTO NEW.school_id FROM public.schools WHERE is_active = true ORDER BY created_at LIMIT 1;
    END IF;
  END IF;
  RETURN NEW;
END $$;

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
    'special_rooms','subjects','homework_assignments','hub_projects','personnel',
    'portfolio_items','students','wall_posts'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_auto_school_id ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_auto_school_id BEFORE INSERT ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.auto_fill_school_id()', t
    );
  END LOOP;
END $$;