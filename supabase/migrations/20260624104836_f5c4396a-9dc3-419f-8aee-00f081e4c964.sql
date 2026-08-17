
ALTER TABLE public.print_templates
  ADD COLUMN IF NOT EXISTS source_pdf_path text,
  ADD COLUMN IF NOT EXISTS source_pdf_pages integer,
  ADD COLUMN IF NOT EXISTS field_map jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS analyze_status text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS analyze_error text,
  ADD COLUMN IF NOT EXISTS analyzed_at timestamptz,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS fill_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz;

CREATE TABLE IF NOT EXISTS public.template_fill_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.print_templates(id) ON DELETE CASCADE,
  student_id uuid,
  filled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_pdf_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.template_fill_history TO authenticated;
GRANT ALL ON public.template_fill_history TO service_role;

ALTER TABLE public.template_fill_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "All authenticated can read fill history" ON public.template_fill_history;
CREATE POLICY "All authenticated can read fill history"
  ON public.template_fill_history FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can insert fill history" ON public.template_fill_history;
CREATE POLICY "Authenticated can insert fill history"
  ON public.template_fill_history FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = filled_by);

DROP POLICY IF EXISTS "Admin/Director manage fill history" ON public.template_fill_history;
CREATE POLICY "Admin/Director manage fill history"
  ON public.template_fill_history FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));
