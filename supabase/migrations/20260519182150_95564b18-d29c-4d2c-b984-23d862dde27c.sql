CREATE TABLE IF NOT EXISTS public.import_mapping_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  raw_text_norm text NOT NULL,
  resolved_id uuid NOT NULL,
  resolved_label text,
  hit_count integer NOT NULL DEFAULT 1,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(entity_type, raw_text_norm)
);

CREATE INDEX IF NOT EXISTS idx_import_mapping_memory_lookup ON public.import_mapping_memory(entity_type, raw_text_norm);

ALTER TABLE public.import_mapping_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage import mapping memory"
ON public.import_mapping_memory FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_import_mapping_memory_updated_at
BEFORE UPDATE ON public.import_mapping_memory
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();