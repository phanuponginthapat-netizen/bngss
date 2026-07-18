
-- 1) Break the eforms <-> eform_recipients recursion via SECURITY DEFINER helpers
CREATE OR REPLACE FUNCTION public.is_eform_sender(_eform_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.eforms e
    WHERE e.id = _eform_id AND e.sender_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_eform_recipient(_eform_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.eform_recipients r
    WHERE r.eform_id = _eform_id AND r.recipient_id = _user_id
  );
$$;

-- Recreate eform_recipients "Sender can manage" using helper (no direct eforms SELECT)
DROP POLICY IF EXISTS "Sender can manage recipients" ON public.eform_recipients;
CREATE POLICY "Sender can manage recipients"
ON public.eform_recipients
FOR ALL
USING (public.is_eform_sender(eform_id, auth.uid()))
WITH CHECK (public.is_eform_sender(eform_id, auth.uid()));

-- Recreate eforms "Recipients can view" using helper (no direct eform_recipients SELECT)
DROP POLICY IF EXISTS "Recipients can view eforms sent to them" ON public.eforms;
CREATE POLICY "Recipients can view eforms sent to them"
ON public.eforms
FOR SELECT
USING (public.is_eform_recipient(id, auth.uid()));

-- 2) Missing GRANTs on public.schools
GRANT SELECT ON public.schools TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schools TO authenticated;
GRANT ALL ON public.schools TO service_role;
