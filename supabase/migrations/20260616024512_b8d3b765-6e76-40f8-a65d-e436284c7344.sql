ALTER TABLE public.id_plan_records
  ADD COLUMN IF NOT EXISTS attachment_paths TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS assigned_teachers JSONB NOT NULL DEFAULT '[]'::jsonb;