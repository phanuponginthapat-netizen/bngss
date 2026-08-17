CREATE OR REPLACE FUNCTION public.prevent_duplicate_face_scan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.face_scan_logs
    WHERE student_id = NEW.student_id
      AND scan_date = NEW.scan_date
      AND scan_type = NEW.scan_type
    LIMIT 1
  ) THEN
    RETURN NULL;
  END IF;

  RETURN NEW;
END;
$$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_prevent_duplicate_face_scan ON public.face_scan_logs';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_prevent_duplicate_face_scan
  BEFORE INSERT ON public.face_scan_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_duplicate_face_scan()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $idxguard$
BEGIN
  EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS idx_face_scan_unique_student_date_type
  ON public.face_scan_logs (student_id, scan_date, scan_type)';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
