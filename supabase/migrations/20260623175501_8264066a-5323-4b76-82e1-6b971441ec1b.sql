-- Fix E-Form RLS recursion so received documents can load in the inbox.
-- Existing public tables: add required Data API grants.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.eforms TO authenticated;
GRANT ALL ON public.eforms TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.eform_recipients TO authenticated;
GRANT ALL ON public.eform_recipients TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.eform_attachments TO authenticated;
GRANT ALL ON public.eform_attachments TO service_role;

-- Security-definer helpers avoid recursive RLS checks between eforms and eform_recipients.
CREATE OR REPLACE FUNCTION public.is_eform_sender(_eform_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.eforms e
    WHERE e.id = _eform_id
      AND e.sender_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_eform(_eform_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.eforms e
    WHERE e.id = _eform_id
      AND (
        e.sender_id = _user_id
        OR EXISTS (
          SELECT 1
          FROM public.eform_recipients r
          WHERE r.eform_id = _eform_id
            AND r.recipient_id = _user_id
        )
        OR public.has_role(_user_id, 'admin'::public.app_role)
        OR public.has_role(_user_id, 'director'::public.app_role)
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_eform_sender(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_eform(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_eform_sender(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.can_access_eform(uuid, uuid) TO service_role;

-- Replace recursive table policies with helper-backed policies.
DROP POLICY IF EXISTS "Recipients can view eforms sent to them" ON public.eforms;
DROP POLICY IF EXISTS "School admin/director can view school eforms" ON public.eforms;
DROP POLICY IF EXISTS "Super/area admin can view all eforms" ON public.eforms;
DROP POLICY IF EXISTS "Sender can manage own eforms" ON public.eforms;

DROP POLICY IF EXISTS "Sender can manage own eforms" ON public.eforms;
CREATE POLICY "Sender can manage own eforms"
ON public.eforms
FOR ALL
TO authenticated
USING (sender_id = auth.uid())
WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS "Recipients and school leaders can view eforms" ON public.eforms;
DROP POLICY IF EXISTS "Recipients and school leaders can view eforms" ON public.eforms;
CREATE POLICY "Recipients and school leaders can view eforms"
ON public.eforms
FOR SELECT
TO authenticated
USING (public.can_access_eform(id, auth.uid()));

DROP POLICY IF EXISTS "Recipient can view own row" ON public.eform_recipients;
DROP POLICY IF EXISTS "Recipient can update own row" ON public.eform_recipients;
DROP POLICY IF EXISTS "Sender can manage recipients" ON public.eform_recipients;
DROP POLICY IF EXISTS "School admin/director can view recipients" ON public.eform_recipients;

DROP POLICY IF EXISTS "Recipient can view own row" ON public.eform_recipients;
CREATE POLICY "Recipient can view own row"
ON public.eform_recipients
FOR SELECT
TO authenticated
USING (recipient_id = auth.uid());

DROP POLICY IF EXISTS "Recipient can update own row" ON public.eform_recipients;
CREATE POLICY "Recipient can update own row"
ON public.eform_recipients
FOR UPDATE
TO authenticated
USING (recipient_id = auth.uid())
WITH CHECK (recipient_id = auth.uid());

DROP POLICY IF EXISTS "Sender can manage recipients" ON public.eform_recipients;
CREATE POLICY "Sender can manage recipients"
ON public.eform_recipients
FOR ALL
TO authenticated
USING (public.is_eform_sender(eform_id, auth.uid()))
WITH CHECK (public.is_eform_sender(eform_id, auth.uid()));

DROP POLICY IF EXISTS "School leaders can view recipients" ON public.eform_recipients;
DROP POLICY IF EXISTS "School leaders can view recipients" ON public.eform_recipients;
CREATE POLICY "School leaders can view recipients"
ON public.eform_recipients
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'director'::public.app_role)
);

DROP POLICY IF EXISTS "View attachments of accessible eforms" ON public.eform_attachments;
DROP POLICY IF EXISTS "Recipients view eform attachments" ON public.eform_attachments;
DROP POLICY IF EXISTS "Sender can manage attachments" ON public.eform_attachments;

DROP POLICY IF EXISTS "Users can view attachments of accessible eforms" ON public.eform_attachments;
DROP POLICY IF EXISTS "Users can view attachments of accessible eforms" ON public.eform_attachments;
CREATE POLICY "Users can view attachments of accessible eforms"
ON public.eform_attachments
FOR SELECT
TO authenticated
USING (public.can_access_eform(eform_id, auth.uid()));

DROP POLICY IF EXISTS "Sender can manage attachments" ON public.eform_attachments;
CREATE POLICY "Sender can manage attachments"
ON public.eform_attachments
FOR ALL
TO authenticated
USING (public.is_eform_sender(eform_id, auth.uid()))
WITH CHECK (public.is_eform_sender(eform_id, auth.uid()));