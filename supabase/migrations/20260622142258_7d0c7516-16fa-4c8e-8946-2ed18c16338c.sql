DROP FUNCTION IF EXISTS public.reset_content_data() CASCADE;
CREATE OR REPLACE FUNCTION public.reset_content_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _summary jsonb := '{}'::jsonb;
  _tables text[] := ARRAY[
    -- attendance / behavior / leave / health
    'attendance','behavior_records','student_leaves','staff_leaves','home_visits',
    'sdq_records','student_screenings','health_records','health_measurements',
    'vaccine_records','early_childhood_dev',
    -- scores / academic records / files
    'student_scores','student_assessment_scores','student_column_scores',
    'exam_submissions','exam_questions','exam_sheets','exams','homework_assignments',
    'school_test_scores','pp5_files','pp6_files','homeroom_records','id_plan_records',
    -- documents / forms / inbox / notifications
    'notifications','inbox_items','eform_attachments','eform_recipients','eforms',
    'document_recipients','documents','task_assignments','emergency_broadcasts',
    'notification_delivery_log',
    -- logs
    'ai_chat_logs','ai_usage_logs','ai_user_memory','audit_logs','error_logs',
    'rate_limit_logs','google_chat_logs','district_feed_logs','district_snapshots',
    'face_scan_logs','face_registration_history','face_registration_requests',
    'student_face_descriptors','time_clock','iot_readings','mascot_advice_cache',
    'archive_logs',
    -- social / portfolio / wall
    'wall_post_reactions','wall_post_comments','wall_posts','social_posts',
    'portfolio_items',
    -- garbage
    'garbage_user_badges','garbage_redemptions','garbage_deposits',
    'garbage_student_points','garbage_personnel_points',
    -- operations: rooms, lunch, milk, loans, assets, procurement, finance
    'learning_center_bookings','school_lunch_records','school_milk_records',
    'ict_loans','asset_damage_reports','procurement_records','budget_transactions',
    'salary_records','account_balances','student_subsidies',
    -- hr / pa
    'hub_project_expenses','hub_project_updates','hub_project_budgets','hub_projects',
    'substitute_teaching','staff_evaluations','personnel_assessments',
    'pa_indicator_scores','pa_agreements','action_plans',
    -- push / line sessions only (keep prefs)
    'push_subscriptions','line_sessions'
  ];
  _t text;
  _count bigint;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admin can reset content data';
  END IF;

  FOREACH _t IN ARRAY _tables LOOP
    BEGIN
      EXECUTE format('SELECT count(*) FROM public.%I', _t) INTO _count;
      EXECUTE format('TRUNCATE TABLE public.%I RESTART IDENTITY CASCADE', _t);
      _summary := _summary || jsonb_build_object(_t, _count);
    EXCEPTION WHEN undefined_table THEN
      -- skip missing tables
      NULL;
    END;
  END LOOP;

  -- log into school_settings (archive_logs was truncated)
  INSERT INTO public.school_settings (setting_key, setting_value)
  VALUES ('last_content_reset', jsonb_build_object(
    'ran_at', now(),
    'ran_by', auth.uid(),
    'summary', _summary
  )::text)
  ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value;

  RETURN jsonb_build_object('ok', true, 'summary', _summary);
END;
$$;
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'REVOKE ALL ON FUNCTION public.reset_content_data() FROM PUBLIC';
    EXIT;
    EXCEPTION
      WHEN deadlock_detected OR lock_not_available THEN
        _ddl_try := _ddl_try + 1;
        IF _ddl_try >= 10 THEN
          RAISE NOTICE 'giving up after lock contention: %', SQLERRM;
          EXIT;
        END IF;
        PERFORM pg_sleep(0.4 * _ddl_try);
      WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
        RAISE NOTICE 'skipped: %', SQLERRM;
        EXIT;
    END;
  END LOOP;
END
$guard$;
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'GRANT EXECUTE ON FUNCTION public.reset_content_data() TO authenticated';
    EXIT;
    EXCEPTION
      WHEN deadlock_detected OR lock_not_available THEN
        _ddl_try := _ddl_try + 1;
        IF _ddl_try >= 10 THEN
          RAISE NOTICE 'giving up after lock contention: %', SQLERRM;
          EXIT;
        END IF;
        PERFORM pg_sleep(0.4 * _ddl_try);
      WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
        RAISE NOTICE 'skipped: %', SQLERRM;
        EXIT;
    END;
  END LOOP;
END
$guard$;
