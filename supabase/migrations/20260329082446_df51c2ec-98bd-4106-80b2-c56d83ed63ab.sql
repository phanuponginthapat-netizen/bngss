DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'ALTER TABLE public.profiles
      ADD COLUMN IF NOT EXISTS nickname text,
      ADD COLUMN IF NOT EXISTS bio text,
      ADD COLUMN IF NOT EXISTS cover_photo_url text,
      ADD COLUMN IF NOT EXISTS date_of_birth date,
      ADD COLUMN IF NOT EXISTS gender text,
      ADD COLUMN IF NOT EXISTS address text,
      ADD COLUMN IF NOT EXISTS line_id text,
      ADD COLUMN IF NOT EXISTS facebook_url text,
      ADD COLUMN IF NOT EXISTS emergency_contact text,
      ADD COLUMN IF NOT EXISTS emergency_phone text,
      ADD COLUMN IF NOT EXISTS blood_type text,
      ADD COLUMN IF NOT EXISTS student_code text,
      ADD COLUMN IF NOT EXISTS employee_code text,
      ADD COLUMN IF NOT EXISTS position_title text,
      ADD COLUMN IF NOT EXISTS department text';
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
