
ALTER TABLE public.line_vault_groups
  ADD COLUMN IF NOT EXISTS drive_root_folder_id text,
  ADD COLUMN IF NOT EXISTS drive_root_url text;
