-- Enhanced auto-link: match personnel by employee_code, email, OR first_name+last_name.
-- Also fill in personnel.prefix/last_name from profile when placeholder values exist,
-- then the existing schedule-name trigger will normalize schedules automatically.
DROP FUNCTION IF EXISTS public.auto_link_personnel_on_profile() CASCADE;
CREATE OR REPLACE FUNCTION public.auto_link_personnel_on_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  p_email TEXT;
  p_employee_code TEXT;
  matched_id UUID;
  derived_prefix TEXT;
BEGIN
  SELECT email INTO p_email FROM auth.users WHERE id = NEW.id;
  p_employee_code := NEW.employee_code;

  -- 1) Match by email
  IF p_email IS NOT NULL THEN
    SELECT id INTO matched_id FROM public.personnel
      WHERE email = p_email AND user_id IS NULL LIMIT 1;
  END IF;

  -- 2) Match by employee_code
  IF matched_id IS NULL AND p_employee_code IS NOT NULL AND p_employee_code <> '' THEN
    SELECT id INTO matched_id FROM public.personnel
      WHERE employee_code = p_employee_code AND user_id IS NULL LIMIT 1;
  END IF;

  -- 3) Match by first_name + last_name (loose: ignore placeholder last_name '-')
  IF matched_id IS NULL AND NEW.first_name IS NOT NULL AND NEW.first_name <> '' THEN
    SELECT id INTO matched_id FROM public.personnel
      WHERE user_id IS NULL
        AND first_name = NEW.first_name
        AND (
          last_name = NEW.last_name
          OR last_name IN ('-','')
          OR last_name IS NULL
          OR NEW.last_name IS NULL
          OR NEW.last_name = ''
        )
      LIMIT 1;
  END IF;

  IF matched_id IS NOT NULL THEN
    -- Derive prefix from gender if personnel prefix is placeholder/empty
    derived_prefix := CASE
      WHEN NEW.gender = 'ชาย' THEN 'นาย'
      WHEN NEW.gender = 'หญิง' THEN 'นางสาว'
      ELSE NULL
    END;

    UPDATE public.personnel SET
      user_id = NEW.id,
      last_name = CASE
        WHEN (last_name IS NULL OR last_name IN ('-','')) AND NEW.last_name IS NOT NULL AND NEW.last_name <> ''
          THEN NEW.last_name
        ELSE last_name
      END,
      prefix = CASE
        WHEN (prefix IS NULL OR prefix IN ('','ครู')) AND derived_prefix IS NOT NULL
          THEN derived_prefix
        ELSE prefix
      END,
      email = COALESCE(email, p_email)
    WHERE id = matched_id;
    -- trg_auto_map_schedule_teacher will normalize schedules.teacher_name automatically.
  END IF;

  RETURN NEW;
END;
$function$;
-- Make the trigger fire on more relevant column changes, not only employee_code
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'DROP TRIGGER IF EXISTS trg_auto_link_personnel ON public.profiles';
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
      EXECUTE 'CREATE TRIGGER trg_auto_link_personnel
    AFTER INSERT OR UPDATE OF employee_code, first_name, last_name, gender
    ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.auto_link_personnel_on_profile()';
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
-- Ensure schedule-name normalizer trigger exists on personnel
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'DROP TRIGGER IF EXISTS trg_auto_map_schedule_teacher ON public.personnel';
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
      EXECUTE 'CREATE TRIGGER trg_auto_map_schedule_teacher
    AFTER INSERT OR UPDATE OF prefix, first_name, last_name
    ON public.personnel
    FOR EACH ROW EXECUTE FUNCTION public.auto_map_schedule_teacher_on_personnel()';
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
