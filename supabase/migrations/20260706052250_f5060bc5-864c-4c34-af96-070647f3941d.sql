DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.pp5_files
  ADD COLUMN IF NOT EXISTS parsed_data JSONB,
  ADD COLUMN IF NOT EXISTS parse_status TEXT DEFAULT ''pending'',
  ADD COLUMN IF NOT EXISTS announced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS announced_by UUID';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $idxguard$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_pp5_files_announced_at ON public.pp5_files(announced_at)';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
DO $idxguard$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_pp5_files_parse_status ON public.pp5_files(parse_status)';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
