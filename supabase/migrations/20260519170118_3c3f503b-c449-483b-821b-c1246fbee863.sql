-- Auto-map schedule teacher_name to canonical full name when matching personnel is created/updated
DROP FUNCTION IF EXISTS public.auto_map_schedule_teacher_on_personnel() CASCADE;
CREATE OR REPLACE FUNCTION public.auto_map_schedule_teacher_on_personnel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  canonical_name text;
  short_name text;
  fn text;
BEGIN
  fn := COALESCE(NEW.first_name, '');
  IF fn = '' THEN RETURN NEW; END IF;

  canonical_name := TRIM(CONCAT(COALESCE(NEW.prefix,''), fn,
    CASE WHEN NEW.last_name IS NOT NULL AND NEW.last_name <> '-' AND NEW.last_name <> ''
         THEN ' ' || NEW.last_name ELSE '' END));
  short_name := 'ครู' || fn;

  -- Update any schedules that reference this teacher by short / partial name
  UPDATE public.schedules
  SET teacher_name = canonical_name,
      updated_at = now()
  WHERE teacher_name IS NOT NULL
    AND teacher_name <> canonical_name
    AND (
      teacher_name = short_name
      OR teacher_name = fn
      OR teacher_name ILIKE 'ครู' || fn || '%'
      OR teacher_name ILIKE fn || '%'
    );

  -- Also map substitute_teaching rows
  BEGIN
    UPDATE public.substitute_teaching
    SET original_teacher = canonical_name
    WHERE original_teacher IS NOT NULL
      AND original_teacher <> canonical_name
      AND (original_teacher = short_name OR original_teacher = fn OR original_teacher ILIKE 'ครู' || fn || '%');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

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
      EXECUTE 'CREATE TRIGGER trg_auto_map_schedule_teacher
    AFTER INSERT OR UPDATE OF first_name, last_name, prefix
    ON public.personnel
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_map_schedule_teacher_on_personnel()';
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
