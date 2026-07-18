CREATE TABLE IF NOT EXISTS public.director_signatures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  position TEXT NOT NULL DEFAULT 'ผู้อำนวยการโรงเรียน',
  signature_url TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.director_signatures TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.director_signatures TO authenticated;
GRANT ALL ON public.director_signatures TO service_role;

ALTER TABLE public.director_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active signatures readable by authenticated users"
ON public.director_signatures FOR SELECT
TO authenticated
USING (is_active = true OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

CREATE POLICY "Admin/director can insert signatures"
ON public.director_signatures FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

CREATE POLICY "Admin/director can update signatures"
ON public.director_signatures FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

CREATE POLICY "Admin/director can delete signatures"
ON public.director_signatures FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

CREATE TRIGGER update_director_signatures_updated_at
BEFORE UPDATE ON public.director_signatures
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER TABLE public.director_signatures REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.director_signatures;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Trigger: enforce only ONE default signature at a time
CREATE OR REPLACE FUNCTION public.enforce_single_default_signature()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE public.director_signatures
    SET is_default = false
    WHERE id <> NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_single_default_signature_trg
AFTER INSERT OR UPDATE OF is_default ON public.director_signatures
FOR EACH ROW WHEN (NEW.is_default = true)
EXECUTE FUNCTION public.enforce_single_default_signature();