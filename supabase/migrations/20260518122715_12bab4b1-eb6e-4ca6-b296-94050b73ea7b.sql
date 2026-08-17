-- 1) Notify parents when behavior is recorded
CREATE OR REPLACE FUNCTION public.notify_parents_on_behavior()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  parent_uid uuid;
  student_name text;
  emoji text;
  type_label text;
BEGIN
  SELECT CONCAT(prefix, first_name, ' ', last_name) INTO student_name
  FROM public.students WHERE id = NEW.student_id;

  IF NEW.behavior_type = 'positive' THEN
    emoji := '⭐'; type_label := 'พฤติกรรมดี';
  ELSIF NEW.behavior_type = 'negative' THEN
    emoji := '⚠️'; type_label := 'พฤติกรรมที่ควรปรับปรุง';
  ELSE
    emoji := '📝'; type_label := 'บันทึกพฤติกรรม';
  END IF;

  FOR parent_uid IN
    SELECT parent_user_id FROM public.parent_student_links
    WHERE student_id = NEW.student_id
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, reference_type, reference_id)
    VALUES (
      parent_uid,
      emoji || ' ' || type_label || ': ' || COALESCE(student_name,''),
      NEW.description || CASE WHEN COALESCE(NEW.points,0) <> 0 THEN ' (' || NEW.points || ' คะแนน)' ELSE '' END,
      'behavior', 'behavior_record', NEW.id
    );
  END LOOP;
  RETURN NEW;
END $$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_notify_parents_on_behavior ON public.behavior_records';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_notify_parents_on_behavior
AFTER INSERT ON public.behavior_records
FOR EACH ROW EXECUTE FUNCTION public.notify_parents_on_behavior()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- 2) Notify parents when student score is added or updated
CREATE OR REPLACE FUNCTION public.notify_parents_on_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  parent_uid uuid;
  student_uuid uuid;
  student_name text;
  subject_name text;
  msg text;
BEGIN
  -- find student by code
  SELECT id, CONCAT(prefix, first_name, ' ', last_name) INTO student_uuid, student_name
  FROM public.students WHERE student_code = NEW.student_code LIMIT 1;

  IF student_uuid IS NULL THEN RETURN NEW; END IF;

  -- skip noisy updates: only notify when grade is finalized or all 3 scores entered
  IF TG_OP = 'UPDATE' THEN
    IF NEW.grade IS NOT DISTINCT FROM OLD.grade
       AND NEW.total_score IS NOT DISTINCT FROM OLD.total_score THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT subject_name INTO subject_name FROM public.subjects WHERE id = NEW.subject_id;

  msg := 'วิชา ' || COALESCE(subject_name,'-') ||
         ' • คะแนนรวม ' || COALESCE(NEW.total_score::text,'-') ||
         CASE WHEN NEW.grade IS NOT NULL THEN ' • เกรด ' || NEW.grade ELSE '' END;

  FOR parent_uid IN
    SELECT parent_user_id FROM public.parent_student_links
    WHERE student_id = student_uuid
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, reference_type, reference_id)
    VALUES (
      parent_uid,
      '📊 ผลคะแนน: ' || COALESCE(student_name,''),
      msg,
      'score', 'student_score', NEW.id
    );
  END LOOP;
  RETURN NEW;
END $$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_notify_parents_on_score ON public.student_scores';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_notify_parents_on_score
AFTER INSERT OR UPDATE ON public.student_scores
FOR EACH ROW EXECUTE FUNCTION public.notify_parents_on_score()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
