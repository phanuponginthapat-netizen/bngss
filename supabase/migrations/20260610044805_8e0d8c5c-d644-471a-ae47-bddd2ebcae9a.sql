
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS building text,
  ADD COLUMN IF NOT EXISTS room text,
  ADD COLUMN IF NOT EXISTS floor text,
  ADD COLUMN IF NOT EXISTS responsible_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS gfmis_code text,
  ADD COLUMN IF NOT EXISTS budget_source text,
  ADD COLUMN IF NOT EXISTS supplier text,
  ADD COLUMN IF NOT EXISTS warranty_until date;

-- Replace overly-narrow SELECT policy with one that allows ALL authenticated users to view
DROP POLICY IF EXISTS "Staff can view assets" ON public.assets;
DROP POLICY IF EXISTS "Authenticated can view assets" ON public.assets;
DROP POLICY IF EXISTS "Authenticated can view assets" ON public.assets;
CREATE POLICY "Authenticated can view assets"
  ON public.assets FOR SELECT
  TO authenticated
  USING (true);

-- Ensure admins/directors can manage
DROP POLICY IF EXISTS "Admins manage assets" ON public.assets;
DROP POLICY IF EXISTS "Admins manage assets" ON public.assets;
CREATE POLICY "Admins manage assets"
  ON public.assets FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'director'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'director'::app_role));
