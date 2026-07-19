
ALTER TABLE public.line_vault_items
  ADD COLUMN IF NOT EXISTS drive_file_id text,
  ADD COLUMN IF NOT EXISTS drive_web_view_link text;

ALTER TABLE public.line_vault_groups
  ADD COLUMN IF NOT EXISTS drive_folder_id text;

CREATE INDEX IF NOT EXISTS idx_lvi_drive_file_id ON public.line_vault_items(drive_file_id) WHERE drive_file_id IS NOT NULL;
