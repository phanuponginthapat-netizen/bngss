DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.subject_score_columns ADD COLUMN IF NOT EXISTS indicator_id uuid REFERENCES public.subject_indicators(id) ON DELETE SET NULL';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $idxguard$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_subject_score_columns_indicator ON public.subject_score_columns(indicator_id)';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
