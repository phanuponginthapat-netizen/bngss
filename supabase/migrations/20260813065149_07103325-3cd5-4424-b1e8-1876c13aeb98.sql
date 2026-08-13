CREATE TABLE IF NOT EXISTS public.personnel_face_descriptors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id uuid NOT NULL REFERENCES public.personnel(id) ON DELETE CASCADE,
  sample_index integer NOT NULL DEFAULT 0,
  descriptor real[] NOT NULL,
  quality_score real,
  captured_by uuid,
  source text DEFAULT 'manual',
  face_image text,
  metrics jsonb,
  model_version text NOT NULL DEFAULT 'face-api-v1',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (personnel_id, sample_index)
);

CREATE INDEX IF NOT EXISTS idx_personnel_face_desc_personnel ON public.personnel_face_descriptors(personnel_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.personnel_face_descriptors TO authenticated;
GRANT ALL ON public.personnel_face_descriptors TO service_role;

ALTER TABLE public.personnel_face_descriptors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff manage personnel face descriptors"
ON public.personnel_face_descriptors FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'director'::app_role) OR public.has_role(auth.uid(), 'teacher'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'director'::app_role) OR public.has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "personnel manage own face descriptors"
ON public.personnel_face_descriptors FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.personnel p WHERE p.id = personnel_face_descriptors.personnel_id AND p.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.personnel p WHERE p.id = personnel_face_descriptors.personnel_id AND p.user_id = auth.uid()));