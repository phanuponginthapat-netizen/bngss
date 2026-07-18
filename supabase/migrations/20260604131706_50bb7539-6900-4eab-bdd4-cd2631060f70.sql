ALTER TABLE public.task_assignments
  ADD COLUMN IF NOT EXISTS annotated_file_url text,
  ADD COLUMN IF NOT EXISTS replies jsonb NOT NULL DEFAULT '[]'::jsonb;