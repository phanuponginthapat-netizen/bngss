-- Backfill NULL school_id on existing data + add missing autofill triggers
DO $$
DECLARE v_school uuid;
BEGIN
  SELECT id INTO v_school FROM public.schools LIMIT 1;
  IF v_school IS NULL THEN RETURN; END IF;

  UPDATE public.classrooms        SET school_id = v_school WHERE school_id IS NULL;
  UPDATE public.subjects          SET school_id = v_school WHERE school_id IS NULL;
  UPDATE public.schedules         SET school_id = v_school WHERE school_id IS NULL;
  UPDATE public.attendance        SET school_id = v_school WHERE school_id IS NULL;
  UPDATE public.face_scan_logs    SET school_id = v_school WHERE school_id IS NULL;
  UPDATE public.behavior_records  SET school_id = v_school WHERE school_id IS NULL;
  UPDATE public.health_records    SET school_id = v_school WHERE school_id IS NULL;
  UPDATE public.health_measurements SET school_id = v_school WHERE school_id IS NULL;
  UPDATE public.homework_assignments SET school_id = v_school WHERE school_id IS NULL;
  UPDATE public.documents         SET school_id = v_school WHERE school_id IS NULL;
  UPDATE public.eforms            SET school_id = v_school WHERE school_id IS NULL;
  UPDATE public.news_posts        SET school_id = v_school WHERE school_id IS NULL;
  UPDATE public.enrollments       SET school_id = v_school WHERE school_id IS NULL;
  UPDATE public.home_visits       SET school_id = v_school WHERE school_id IS NULL;
  UPDATE public.homeroom_records  SET school_id = v_school WHERE school_id IS NULL;
  UPDATE public.sdq_records       SET school_id = v_school WHERE school_id IS NULL;
  UPDATE public.portfolio_items   SET school_id = v_school WHERE school_id IS NULL;
  UPDATE public.assets            SET school_id = v_school WHERE school_id IS NULL;
  UPDATE public.action_plans      SET school_id = v_school WHERE school_id IS NULL;
  UPDATE public.admissions        SET school_id = v_school WHERE school_id IS NULL;
  UPDATE public.academic_events   SET school_id = v_school WHERE school_id IS NULL;
  UPDATE public.account_balances  SET school_id = v_school WHERE school_id IS NULL;
  UPDATE public.budget_transactions SET school_id = v_school WHERE school_id IS NULL;
  UPDATE public.early_childhood_dev SET school_id = v_school WHERE school_id IS NULL;
  UPDATE public.hub_projects      SET school_id = v_school WHERE school_id IS NULL;
  UPDATE public.ict_devices       SET school_id = v_school WHERE school_id IS NULL;
  UPDATE public.ict_loans         SET school_id = v_school WHERE school_id IS NULL;
  UPDATE public.learning_center_bookings SET school_id = v_school WHERE school_id IS NULL;
  UPDATE public.procurement_records SET school_id = v_school WHERE school_id IS NULL;
  UPDATE public.salary_records    SET school_id = v_school WHERE school_id IS NULL;
  UPDATE public.school_lunch_records SET school_id = v_school WHERE school_id IS NULL;
  UPDATE public.school_milk_records SET school_id = v_school WHERE school_id IS NULL;
  UPDATE public.school_test_scores SET school_id = v_school WHERE school_id IS NULL;
  UPDATE public.special_rooms     SET school_id = v_school WHERE school_id IS NULL;
  UPDATE public.wall_posts        SET school_id = v_school WHERE school_id IS NULL;
END $$;
-- Add missing autofill triggers
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_autofill_school_id ON public.subjects';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_autofill_school_id BEFORE INSERT ON public.subjects
  FOR EACH ROW EXECUTE FUNCTION public.auto_fill_school_id()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_autofill_school_id ON public.schedules';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_autofill_school_id BEFORE INSERT ON public.schedules
  FOR EACH ROW EXECUTE FUNCTION public.auto_fill_school_id()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- Improve duplicate face scan trigger: instead of silently dropping (which confuses the client),
-- raise a proper unique_violation so the client can detect "already scanned today" cleanly.
DROP FUNCTION IF EXISTS public.prevent_duplicate_face_scan() CASCADE;
CREATE OR REPLACE FUNCTION public.prevent_duplicate_face_scan()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.face_scan_logs
    WHERE student_id = NEW.student_id
      AND scan_date = NEW.scan_date
      AND scan_type = NEW.scan_type
  ) THEN
    RAISE EXCEPTION 'duplicate face scan for student % on % type %', NEW.student_id, NEW.scan_date, NEW.scan_type
      USING ERRCODE = 'unique_violation';
  END IF;
  RETURN NEW;
END;
$$;
