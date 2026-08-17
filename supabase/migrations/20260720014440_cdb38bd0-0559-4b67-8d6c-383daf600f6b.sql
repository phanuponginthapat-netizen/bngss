CREATE TABLE IF NOT EXISTS public.line_vault_drive_trash (
  id uuid primary key default gen_random_uuid(),
  drive_file_id text not null,
  source_item_id uuid,
  line_group_id text,
  status text not null default 'pending',
  attempts int not null default 0,
  last_error text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);
DO $guard$
BEGIN
  EXECUTE 'GRANT ALL ON public.line_vault_drive_trash TO service_role';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.line_vault_drive_trash ENABLE ROW LEVEL SECURITY';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "trash_admin_read" ON public.line_vault_drive_trash';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "trash_admin_read" ON public.line_vault_drive_trash';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "trash_admin_read" ON public.line_vault_drive_trash
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), ''admin''::app_role) OR has_role(auth.uid(), ''super_admin''::app_role))';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $idxguard$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_lvdt_pending ON public.line_vault_drive_trash(status, created_at) WHERE status = ''pending''';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
DROP FUNCTION IF EXISTS public.queue_drive_file_deletion() CASCADE;
CREATE OR REPLACE FUNCTION public.queue_drive_file_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.drive_file_id IS NOT NULL AND length(OLD.drive_file_id) > 0 THEN
    INSERT INTO public.line_vault_drive_trash(drive_file_id, source_item_id, line_group_id)
    VALUES (OLD.drive_file_id, OLD.id, OLD.line_group_id);
  END IF;
  RETURN OLD;
END;
$$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_lvi_queue_drive_delete ON public.line_vault_items';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_lvi_queue_drive_delete
AFTER DELETE ON public.line_vault_items
FOR EACH ROW
EXECUTE FUNCTION public.queue_drive_file_deletion()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
