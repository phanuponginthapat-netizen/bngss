DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.line_vault_groups
  ADD COLUMN IF NOT EXISTS notify_cooldown_minutes INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS last_notified_at TIMESTAMPTZ';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.line_vault_items
  ADD COLUMN IF NOT EXISTS line_image_set_id TEXT';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $idxguard$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_line_vault_items_image_set
  ON public.line_vault_items(line_image_set_id)
  WHERE line_image_set_id IS NOT NULL';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
