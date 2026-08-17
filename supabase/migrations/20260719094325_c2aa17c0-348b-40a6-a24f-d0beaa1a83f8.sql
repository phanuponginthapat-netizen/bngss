DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.line_vault_items 
  ADD COLUMN IF NOT EXISTS academic_year int,
  ADD COLUMN IF NOT EXISTS semester int,
  ADD COLUMN IF NOT EXISTS category text';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.line_vault_groups
  ADD COLUMN IF NOT EXISTS default_category text';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $idxguard$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_lvi_year_sem ON public.line_vault_items(academic_year, semester)';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
DO $idxguard$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_lvi_category ON public.line_vault_items(category)';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
DO $idxguard$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_lvi_image_set ON public.line_vault_items(line_image_set_id) WHERE line_image_set_id IS NOT NULL';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
-- Auto-fill academic_year/semester on insert if null (Bangkok TZ)
CREATE OR REPLACE FUNCTION public.line_vault_autofill_ay()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  now_bkk timestamptz := (now() AT TIME ZONE 'Asia/Bangkok');
  m int := EXTRACT(MONTH FROM now_bkk);
  y int := EXTRACT(YEAR FROM now_bkk);
BEGIN
  IF NEW.academic_year IS NULL THEN
    NEW.academic_year := CASE WHEN m >= 5 THEN y ELSE y - 1 END;
  END IF;
  IF NEW.semester IS NULL THEN
    NEW.semester := CASE WHEN m >= 5 AND m <= 10 THEN 1 ELSE 2 END;
  END IF;
  RETURN NEW;
END $$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_lvi_autofill_ay ON public.line_vault_items';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_lvi_autofill_ay BEFORE INSERT ON public.line_vault_items
  FOR EACH ROW EXECUTE FUNCTION public.line_vault_autofill_ay()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
