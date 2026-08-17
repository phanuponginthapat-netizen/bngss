DROP FUNCTION IF EXISTS public.sync_gender_from_prefix() CASCADE;
CREATE OR REPLACE FUNCTION public.sync_gender_from_prefix()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  p TEXT;
BEGIN
  p := COALESCE(NEW.prefix, '');
  -- normalize whitespace
  p := regexp_replace(p, '\s+', '', 'g');

  IF p IN ('ด.ช.', 'เด็กชาย', 'นาย', 'ดช', 'ดช.') THEN
    NEW.gender := 'ชาย';
  ELSIF p IN ('ด.ญ.', 'เด็กหญิง', 'นาง', 'นางสาว', 'น.ส.', 'ดญ', 'ดญ.') THEN
    NEW.gender := 'หญิง';
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
      EXECUTE 'DROP TRIGGER IF EXISTS trg_students_sync_gender ON public.students';
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
      EXECUTE 'CREATE TRIGGER trg_students_sync_gender
      BEFORE INSERT OR UPDATE OF prefix ON public.students
      FOR EACH ROW
      EXECUTE FUNCTION public.sync_gender_from_prefix()';
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
-- Backfill
UPDATE public.students
SET gender = CASE
  WHEN regexp_replace(COALESCE(prefix,''), '\s+', '', 'g') IN ('ด.ช.','เด็กชาย','นาย','ดช','ดช.') THEN 'ชาย'
  WHEN regexp_replace(COALESCE(prefix,''), '\s+', '', 'g') IN ('ด.ญ.','เด็กหญิง','นาง','นางสาว','น.ส.','ดญ','ดญ.') THEN 'หญิง'
  ELSE gender
END
WHERE prefix IS NOT NULL
  AND (gender IS NULL OR gender = '' OR gender NOT IN ('ชาย','หญิง'));
