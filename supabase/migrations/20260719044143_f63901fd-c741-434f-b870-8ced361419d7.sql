-- 1) homework_submissions: prevent students from self-grading
DROP FUNCTION IF EXISTS public.prevent_student_grade_tamper_homework() CASCADE;
CREATE OR REPLACE FUNCTION public.prevent_student_grade_tamper_homework()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_staff boolean;
BEGIN
  is_staff := has_role(auth.uid(), 'admin'::app_role)
           OR has_role(auth.uid(), 'director'::app_role)
           OR has_role(auth.uid(), 'teacher'::app_role);
  IF is_staff THEN RETURN NEW; END IF;

  -- non-staff (student) cannot change grading fields
  IF NEW.score IS DISTINCT FROM OLD.score
     OR NEW.final_score IS DISTINCT FROM OLD.final_score
     OR NEW.graded_by IS DISTINCT FROM OLD.graded_by
     OR NEW.feedback IS DISTINCT FROM OLD.feedback THEN
    RAISE EXCEPTION 'ไม่มีสิทธิ์แก้ไขคะแนน/ข้อเสนอแนะของการบ้าน (grade fields are staff-only)';
  END IF;
  -- students may only move status to submitted/draft, not to graded/returned
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status NOT IN ('draft','submitted') THEN
    RAISE EXCEPTION 'ไม่มีสิทธิ์เปลี่ยนสถานะการตรวจการบ้าน';
  END IF;
  RETURN NEW;
END;
$$;
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'DROP TRIGGER IF EXISTS trg_prevent_student_grade_tamper_homework ON public.homework_submissions';
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
      EXECUTE 'CREATE TRIGGER trg_prevent_student_grade_tamper_homework
      BEFORE UPDATE ON public.homework_submissions
      FOR EACH ROW EXECUTE FUNCTION public.prevent_student_grade_tamper_homework()';
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
-- 2) task_assignments: prevent students from self-grading
DROP FUNCTION IF EXISTS public.prevent_student_grade_tamper_task() CASCADE;
CREATE OR REPLACE FUNCTION public.prevent_student_grade_tamper_task()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_staff boolean;
BEGIN
  is_staff := has_role(auth.uid(), 'admin'::app_role)
           OR has_role(auth.uid(), 'director'::app_role)
           OR has_role(auth.uid(), 'teacher'::app_role);
  IF is_staff THEN RETURN NEW; END IF;

  IF NEW.grade IS DISTINCT FROM OLD.grade
     OR NEW.feedback IS DISTINCT FROM OLD.feedback
     OR NEW.annotated_file_url IS DISTINCT FROM OLD.annotated_file_url THEN
    RAISE EXCEPTION 'ไม่มีสิทธิ์แก้ไขคะแนน/ข้อเสนอแนะของงานที่มอบหมาย (grading fields are staff-only)';
  END IF;
  RETURN NEW;
END;
$$;
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'DROP TRIGGER IF EXISTS trg_prevent_student_grade_tamper_task ON public.task_assignments';
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
      EXECUTE 'CREATE TRIGGER trg_prevent_student_grade_tamper_task
      BEFORE UPDATE ON public.task_assignments
      FOR EACH ROW EXECUTE FUNCTION public.prevent_student_grade_tamper_task()';
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
-- 3) profiles: prevent users from self-escalating school/approval/password fields
DROP FUNCTION IF EXISTS public.prevent_profile_self_escalation() CASCADE;
CREATE OR REPLACE FUNCTION public.prevent_profile_self_escalation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_admin boolean;
BEGIN
  is_admin := has_role(auth.uid(), 'admin'::app_role)
           OR has_role(auth.uid(), 'director'::app_role);
  IF is_admin THEN RETURN NEW; END IF;

  -- non-admin (i.e., the user themselves) cannot change sensitive fields
  IF NEW.school_id IS DISTINCT FROM OLD.school_id THEN
    RAISE EXCEPTION 'ไม่มีสิทธิ์เปลี่ยนโรงเรียนของโปรไฟล์ (school_id is admin-only)';
  END IF;
  IF NEW.is_approved IS DISTINCT FROM OLD.is_approved THEN
    RAISE EXCEPTION 'ไม่มีสิทธิ์เปลี่ยนสถานะอนุมัติของโปรไฟล์ (is_approved is admin-only)';
  END IF;
  IF NEW.must_change_password IS DISTINCT FROM OLD.must_change_password THEN
    RAISE EXCEPTION 'ไม่มีสิทธิ์เปลี่ยนสถานะบังคับเปลี่ยนรหัสผ่าน (must_change_password is admin-only)';
  END IF;
  RETURN NEW;
END;
$$;
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'DROP TRIGGER IF EXISTS trg_prevent_profile_self_escalation ON public.profiles';
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
      EXECUTE 'CREATE TRIGGER trg_prevent_profile_self_escalation
      BEFORE UPDATE ON public.profiles
      FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_self_escalation()';
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
