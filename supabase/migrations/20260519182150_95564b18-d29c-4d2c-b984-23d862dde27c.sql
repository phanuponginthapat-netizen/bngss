CREATE TABLE IF NOT EXISTS public.import_mapping_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  raw_text_norm text NOT NULL,
  resolved_id uuid NOT NULL,
  resolved_label text,
  hit_count integer NOT NULL DEFAULT 1,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(entity_type, raw_text_norm)
);
DO $idxguard$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_import_mapping_memory_lookup ON public.import_mapping_memory(entity_type, raw_text_norm)';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'ALTER TABLE public.import_mapping_memory ENABLE ROW LEVEL SECURITY';
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
      EXECUTE 'DROP POLICY IF EXISTS "Admin manage import mapping memory" ON public.import_mapping_memory';
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
      EXECUTE 'DROP POLICY IF EXISTS "Admin manage import mapping memory" ON public.import_mapping_memory';
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
      EXECUTE 'CREATE POLICY "Admin manage import mapping memory"
    ON public.import_mapping_memory FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), ''admin''))
    WITH CHECK (public.has_role(auth.uid(), ''admin''))';
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
      EXECUTE 'DROP TRIGGER IF EXISTS trg_import_mapping_memory_updated_at ON public.import_mapping_memory';
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
      EXECUTE 'CREATE TRIGGER trg_import_mapping_memory_updated_at
    BEFORE UPDATE ON public.import_mapping_memory
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()';
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
