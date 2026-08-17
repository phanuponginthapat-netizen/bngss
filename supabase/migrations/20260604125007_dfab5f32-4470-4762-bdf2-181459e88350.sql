CREATE TABLE IF NOT EXISTS public.ai_bot_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  source text,
  enabled boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_bot_knowledge TO authenticated;
GRANT ALL ON public.ai_bot_knowledge TO service_role;
ALTER TABLE public.ai_bot_knowledge ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can read enabled knowledge" ON public.ai_bot_knowledge;
CREATE POLICY "Authenticated can read enabled knowledge"
  ON public.ai_bot_knowledge FOR SELECT TO authenticated
  USING (enabled = true OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));
DROP POLICY IF EXISTS "Admin/director can manage knowledge" ON public.ai_bot_knowledge;
CREATE POLICY "Admin/director can manage knowledge"
  ON public.ai_bot_knowledge FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));
CREATE INDEX IF NOT EXISTS idx_ai_bot_knowledge_enabled ON public.ai_bot_knowledge(enabled, updated_at DESC);