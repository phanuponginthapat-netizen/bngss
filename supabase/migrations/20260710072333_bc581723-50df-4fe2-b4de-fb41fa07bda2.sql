DROP FUNCTION IF EXISTS public._is_admin_or_director() CASCADE;
CREATE OR REPLACE FUNCTION public._is_admin_or_director()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'director'::app_role);
$$;
-- homework_submissions
DROP FUNCTION IF EXISTS public.guard_homework_submissions_update() CASCADE;
CREATE OR REPLACE FUNCTION public.guard_homework_submissions_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE is_owner boolean;
BEGIN
  IF public._is_admin_or_director() THEN RETURN NEW; END IF;
  SELECT EXISTS (SELECT 1 FROM public.homework_assignments a
                 WHERE a.id = NEW.assignment_id AND a.created_by = auth.uid())
    INTO is_owner;
  IF is_owner THEN RETURN NEW; END IF;
  NEW.score := OLD.score;
  NEW.auto_score := OLD.auto_score;
  NEW.final_score := OLD.final_score;
  NEW.feedback := OLD.feedback;
  NEW.graded_by := OLD.graded_by;
  NEW.graded_at := OLD.graded_at;
  RETURN NEW;
END; $$;
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'DROP TRIGGER IF EXISTS trg_guard_homework_submissions_update ON public.homework_submissions';
    EXIT;
    EXCEPTION
      WHEN deadlock_detected OR lock_not_available THEN
        _ddl_try := _ddl_try + 1;
        IF _ddl_try >= 10 THEN
          RAISE NOTICE 'giving up after lock contention: %', SQLERRM;
          EXIT;
        END IF;
        PERFORM pg_sleep(0.4 * _ddl_try);
      WHEN insufficient_privilege OR undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
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
      EXECUTE 'CREATE TRIGGER trg_guard_homework_submissions_update
    BEFORE UPDATE ON public.homework_submissions
    FOR EACH ROW EXECUTE FUNCTION public.guard_homework_submissions_update()';
    EXIT;
    EXCEPTION
      WHEN deadlock_detected OR lock_not_available THEN
        _ddl_try := _ddl_try + 1;
        IF _ddl_try >= 10 THEN
          RAISE NOTICE 'giving up after lock contention: %', SQLERRM;
          EXIT;
        END IF;
        PERFORM pg_sleep(0.4 * _ddl_try);
      WHEN insufficient_privilege OR undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
        RAISE NOTICE 'skipped: %', SQLERRM;
        EXIT;
    END;
  END LOOP;
END
$guard$;
-- personnel
DROP FUNCTION IF EXISTS public.guard_personnel_update() CASCADE;
CREATE OR REPLACE FUNCTION public.guard_personnel_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public._is_admin_or_director() THEN RETURN NEW; END IF;
  NEW.department := OLD.department;
  NEW.school_id := OLD.school_id;
  NEW.position := OLD.position;
  NEW.position_level := OLD.position_level;
  NEW.subject_group := OLD.subject_group;
  NEW.academic_standing := OLD.academic_standing;
  NEW.employee_code := OLD.employee_code;
  NEW.user_id := OLD.user_id;
  NEW.status := OLD.status;
  NEW.hire_date := OLD.hire_date;
  RETURN NEW;
END; $$;
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'DROP TRIGGER IF EXISTS trg_guard_personnel_update ON public.personnel';
    EXIT;
    EXCEPTION
      WHEN deadlock_detected OR lock_not_available THEN
        _ddl_try := _ddl_try + 1;
        IF _ddl_try >= 10 THEN
          RAISE NOTICE 'giving up after lock contention: %', SQLERRM;
          EXIT;
        END IF;
        PERFORM pg_sleep(0.4 * _ddl_try);
      WHEN insufficient_privilege OR undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
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
      EXECUTE 'CREATE TRIGGER trg_guard_personnel_update
    BEFORE UPDATE ON public.personnel
    FOR EACH ROW EXECUTE FUNCTION public.guard_personnel_update()';
    EXIT;
    EXCEPTION
      WHEN deadlock_detected OR lock_not_available THEN
        _ddl_try := _ddl_try + 1;
        IF _ddl_try >= 10 THEN
          RAISE NOTICE 'giving up after lock contention: %', SQLERRM;
          EXIT;
        END IF;
        PERFORM pg_sleep(0.4 * _ddl_try);
      WHEN insufficient_privilege OR undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
        RAISE NOTICE 'skipped: %', SQLERRM;
        EXIT;
    END;
  END LOOP;
END
$guard$;
-- staff_leaves
DROP FUNCTION IF EXISTS public.guard_staff_leaves_update() CASCADE;
CREATE OR REPLACE FUNCTION public.guard_staff_leaves_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public._is_admin_or_director() THEN RETURN NEW; END IF;
  IF COALESCE(OLD.status, 'pending') <> 'pending' THEN
    RAISE EXCEPTION 'Cannot modify a leave request after it has been reviewed';
  END IF;
  NEW.status := OLD.status;
  NEW.approved_by := OLD.approved_by;
  NEW.approved_at := OLD.approved_at;
  NEW.rejected_reason := OLD.rejected_reason;
  RETURN NEW;
END; $$;
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'DROP TRIGGER IF EXISTS trg_guard_staff_leaves_update ON public.staff_leaves';
    EXIT;
    EXCEPTION
      WHEN deadlock_detected OR lock_not_available THEN
        _ddl_try := _ddl_try + 1;
        IF _ddl_try >= 10 THEN
          RAISE NOTICE 'giving up after lock contention: %', SQLERRM;
          EXIT;
        END IF;
        PERFORM pg_sleep(0.4 * _ddl_try);
      WHEN insufficient_privilege OR undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
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
      EXECUTE 'CREATE TRIGGER trg_guard_staff_leaves_update
    BEFORE UPDATE ON public.staff_leaves
    FOR EACH ROW EXECUTE FUNCTION public.guard_staff_leaves_update()';
    EXIT;
    EXCEPTION
      WHEN deadlock_detected OR lock_not_available THEN
        _ddl_try := _ddl_try + 1;
        IF _ddl_try >= 10 THEN
          RAISE NOTICE 'giving up after lock contention: %', SQLERRM;
          EXIT;
        END IF;
        PERFORM pg_sleep(0.4 * _ddl_try);
      WHEN insufficient_privilege OR undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
        RAISE NOTICE 'skipped: %', SQLERRM;
        EXIT;
    END;
  END LOOP;
END
$guard$;
-- task_assignments
DROP FUNCTION IF EXISTS public.guard_task_assignments_update() CASCADE;
CREATE OR REPLACE FUNCTION public.guard_task_assignments_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE is_student_owner boolean;
BEGIN
  IF public._is_admin_or_director() THEN RETURN NEW; END IF;
  IF OLD.assigned_by = auth.uid() THEN RETURN NEW; END IF;
  SELECT EXISTS (SELECT 1 FROM public.students s
                 WHERE s.auth_user_id = auth.uid()
                   AND (s.id = OLD.assigned_to_student_id OR s.classroom_id = OLD.classroom_id))
    INTO is_student_owner;
  IF is_student_owner THEN
    NEW.grade := OLD.grade;
    NEW.feedback := OLD.feedback;
    NEW.annotated_file_url := OLD.annotated_file_url;
    NEW.max_score := OLD.max_score;
    NEW.assigned_by := OLD.assigned_by;
    NEW.assigned_to_user_id := OLD.assigned_to_user_id;
    NEW.assigned_to_student_id := OLD.assigned_to_student_id;
    NEW.classroom_id := OLD.classroom_id;
    NEW.subject_id := OLD.subject_id;
    NEW.task_type := OLD.task_type;
    NEW.title := OLD.title;
    NEW.description := OLD.description;
    NEW.due_date := OLD.due_date;
    NEW.assigned_date := OLD.assigned_date;
  END IF;
  RETURN NEW;
END; $$;
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'DROP TRIGGER IF EXISTS trg_guard_task_assignments_update ON public.task_assignments';
    EXIT;
    EXCEPTION
      WHEN deadlock_detected OR lock_not_available THEN
        _ddl_try := _ddl_try + 1;
        IF _ddl_try >= 10 THEN
          RAISE NOTICE 'giving up after lock contention: %', SQLERRM;
          EXIT;
        END IF;
        PERFORM pg_sleep(0.4 * _ddl_try);
      WHEN insufficient_privilege OR undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
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
      EXECUTE 'CREATE TRIGGER trg_guard_task_assignments_update
    BEFORE UPDATE ON public.task_assignments
    FOR EACH ROW EXECUTE FUNCTION public.guard_task_assignments_update()';
    EXIT;
    EXCEPTION
      WHEN deadlock_detected OR lock_not_available THEN
        _ddl_try := _ddl_try + 1;
        IF _ddl_try >= 10 THEN
          RAISE NOTICE 'giving up after lock contention: %', SQLERRM;
          EXIT;
        END IF;
        PERFORM pg_sleep(0.4 * _ddl_try);
      WHEN insufficient_privilege OR undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
        RAISE NOTICE 'skipped: %', SQLERRM;
        EXIT;
    END;
  END LOOP;
END
$guard$;
