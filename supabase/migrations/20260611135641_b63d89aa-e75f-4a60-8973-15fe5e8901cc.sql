ALTER TABLE public.id_plan_records
  ADD COLUMN IF NOT EXISTS order_doc_path text,
  ADD COLUMN IF NOT EXISTS image_paths text[] NOT NULL DEFAULT '{}'::text[];