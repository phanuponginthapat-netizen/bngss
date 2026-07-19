
ALTER TABLE public.line_vault_groups
  ADD COLUMN IF NOT EXISTS notify_cooldown_minutes INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS last_notified_at TIMESTAMPTZ;

ALTER TABLE public.line_vault_items
  ADD COLUMN IF NOT EXISTS line_image_set_id TEXT;

CREATE INDEX IF NOT EXISTS idx_line_vault_items_image_set
  ON public.line_vault_items(line_image_set_id)
  WHERE line_image_set_id IS NOT NULL;
