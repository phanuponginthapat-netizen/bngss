
-- Break recursive RLS: documents.SELECT references document_recipients,
-- and document_recipients policies reference documents.
-- Use SECURITY DEFINER helpers to bypass RLS for these cross-table checks.

CREATE OR REPLACE FUNCTION public.is_document_recipient(_doc uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.document_recipients
    WHERE document_id = _doc AND recipient_user_id = _user
  );
$$;

CREATE OR REPLACE FUNCTION public.is_document_owner(_doc uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.documents
    WHERE id = _doc AND created_by = _user
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_document_recipient(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_document_owner(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_document_recipient(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_document_owner(uuid, uuid) TO authenticated, service_role;

-- documents: replace recursive recipient policy
DROP POLICY IF EXISTS "Recipients view their documents" ON public.documents;
DROP POLICY IF EXISTS "Recipients view their documents" ON public.documents;
CREATE POLICY "Recipients view their documents"
ON public.documents
FOR SELECT
TO authenticated
USING (public.is_document_recipient(id, auth.uid()));

-- document_recipients: replace recursive owner-check policies
DROP POLICY IF EXISTS "Recipients and staff can view document_recipients" ON public.document_recipients;
DROP POLICY IF EXISTS "Recipients and staff can view document_recipients" ON public.document_recipients;
CREATE POLICY "Recipients and staff can view document_recipients"
ON public.document_recipients
FOR SELECT
TO authenticated
USING (
  recipient_user_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'director'::app_role)
  OR public.is_document_owner(document_id, auth.uid())
);

DROP POLICY IF EXISTS "Doc owner or admin can add recipients" ON public.document_recipients;
DROP POLICY IF EXISTS "Doc owner or admin can add recipients" ON public.document_recipients;
CREATE POLICY "Doc owner or admin can add recipients"
ON public.document_recipients
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_document_owner(document_id, auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'director'::app_role)
);
