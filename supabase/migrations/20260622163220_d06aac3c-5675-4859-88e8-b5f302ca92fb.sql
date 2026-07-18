
ALTER TABLE public.print_templates
  ADD COLUMN IF NOT EXISTS background_url TEXT,
  ADD COLUMN IF NOT EXISTS overlay_mode BOOLEAN NOT NULL DEFAULT false;
