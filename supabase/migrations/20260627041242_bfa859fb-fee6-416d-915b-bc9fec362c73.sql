ALTER TABLE public.worksheets
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS page_count int;