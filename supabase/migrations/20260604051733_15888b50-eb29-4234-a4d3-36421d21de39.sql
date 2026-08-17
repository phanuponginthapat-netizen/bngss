-- Prevent alumni/inactive students from overlapping current classrooms
CREATE OR REPLACE FUNCTION public.clear_classroom_on_graduation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('graduated', 'inactive', 'transferred') THEN
    -- Snapshot graduation info from current classroom before clearing
    IF NEW.status = 'graduated' THEN
      IF NEW.graduated_at IS NULL THEN NEW.graduated_at := CURRENT_DATE; END IF;
      IF NEW.graduation_year IS NULL THEN NEW.graduation_year := EXTRACT(YEAR FROM CURRENT_DATE)::int; END IF;
      IF NEW.graduation_level IS NULL AND OLD.classroom_id IS NOT NULL THEN
        SELECT grade_level INTO NEW.graduation_level FROM public.classrooms WHERE id = OLD.classroom_id;
      END IF;
    END IF;
    -- Detach from current classroom so they no longer appear in active rosters
    NEW.classroom_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_clear_classroom_on_graduation ON public.students';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_clear_classroom_on_graduation
  BEFORE UPDATE OF status ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.clear_classroom_on_graduation()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- Backfill: any non-active student still pointing at a classroom should be detached
UPDATE public.students
SET classroom_id = NULL
WHERE status IN ('graduated', 'inactive', 'transferred')
  AND classroom_id IS NOT NULL;
