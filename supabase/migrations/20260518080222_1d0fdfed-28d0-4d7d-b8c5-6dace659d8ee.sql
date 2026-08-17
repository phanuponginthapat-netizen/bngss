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
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_students_sync_gender ON public.students';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_students_sync_gender
  BEFORE INSERT OR UPDATE OF prefix ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_gender_from_prefix()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
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
