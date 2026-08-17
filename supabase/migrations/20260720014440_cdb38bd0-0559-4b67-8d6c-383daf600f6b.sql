
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

GRANT ALL ON public.line_vault_drive_trash TO service_role;

ALTER TABLE public.line_vault_drive_trash ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trash_admin_read" ON public.line_vault_drive_trash;
DROP POLICY IF EXISTS "trash_admin_read" ON public.line_vault_drive_trash;
CREATE POLICY "trash_admin_read" ON public.line_vault_drive_trash
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_lvdt_pending ON public.line_vault_drive_trash(status, created_at) WHERE status = 'pending';

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

DROP TRIGGER IF EXISTS trg_lvi_queue_drive_delete ON public.line_vault_items;
CREATE TRIGGER trg_lvi_queue_drive_delete
AFTER DELETE ON public.line_vault_items
FOR EACH ROW
EXECUTE FUNCTION public.queue_drive_file_deletion();
