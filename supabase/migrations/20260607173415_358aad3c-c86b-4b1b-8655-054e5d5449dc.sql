DROP FUNCTION IF EXISTS public.sync_student_to_profile() CASCADE;
CREATE OR REPLACE FUNCTION public.sync_student_to_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grade_level TEXT;
  v_target_id UUID;
BEGIN
  -- look up grade level from classroom
  IF NEW.classroom_id IS NOT NULL THEN
    SELECT grade_level INTO v_grade_level FROM public.classrooms WHERE id = NEW.classroom_id;
  END IF;

  -- find target profile: prefer auth_user_id, fallback to student_code
  IF NEW.auth_user_id IS NOT NULL THEN
    v_target_id := NEW.auth_user_id;
  ELSE
    SELECT id INTO v_target_id FROM public.profiles WHERE student_code = NEW.student_code LIMIT 1;
  END IF;

  IF v_target_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.profiles
  SET
    first_name      = COALESCE(NEW.first_name, first_name),
    last_name       = COALESCE(NEW.last_name, last_name),
    gender          = COALESCE(NEW.gender, gender),
    date_of_birth   = COALESCE(NEW.date_of_birth, date_of_birth),
    address         = COALESCE(NEW.address, address),
    phone           = COALESCE(NEW.phone, phone),
    blood_type      = COALESCE(NEW.blood_type, blood_type),
    avatar_url      = COALESCE(NEW.photo_url, avatar_url),
    student_code    = COALESCE(NEW.student_code, student_code),
    department      = COALESCE(v_grade_level, department),
    school_id       = COALESCE(NEW.school_id, school_id),
    updated_at      = now()
  WHERE id = v_target_id;

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
      EXECUTE 'DROP TRIGGER IF EXISTS trg_sync_student_to_profile ON public.students';
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
      EXECUTE 'CREATE TRIGGER trg_sync_student_to_profile
    AFTER INSERT OR UPDATE ON public.students
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_student_to_profile()';
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
