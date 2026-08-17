CREATE OR REPLACE FUNCTION public.is_document_recipient(_doc uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.document_recipients dr
    LEFT JOIN public.profiles p ON p.id = _user
    WHERE dr.document_id = _doc
      AND (
        dr.recipient_user_id = _user
        OR (
          dr.recipient_type = 'department'
          AND p.department IS NOT NULL
          AND dr.recipient_name = p.department
        )
        OR (
          dr.recipient_type = 'department'
          AND public.has_role(_user, 'director')
          AND dr.recipient_name = 'ผู้อำนวยการ'
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_document_recipient(_recipient_row uuid, _doc uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.document_recipients dr
    LEFT JOIN public.profiles p ON p.id = _user
    WHERE dr.id = _recipient_row
      AND dr.document_id = _doc
      AND (
        dr.recipient_user_id = _user
        OR (
          dr.recipient_type = 'department'
          AND p.department IS NOT NULL
          AND dr.recipient_name = p.department
        )
        OR (
          dr.recipient_type = 'department'
          AND public.has_role(_user, 'director')
          AND dr.recipient_name = 'ผู้อำนวยการ'
        )
        OR public.has_role(_user, 'admin')
        OR public.has_role(_user, 'director')
        OR public.is_document_owner(_doc, _user)
      )
  );
$$;

REVOKE ALL ON FUNCTION public.is_document_recipient(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_document_recipient(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_document_recipient(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_document_recipient(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_document_recipient(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.can_access_document_recipient(uuid, uuid, uuid) TO service_role;

DROP POLICY IF EXISTS "Recipients and staff can view document_recipients" ON public.document_recipients;
DROP POLICY IF EXISTS "Recipients and staff can view document_recipients" ON public.document_recipients;
CREATE POLICY "Recipients and staff can view document_recipients"
ON public.document_recipients
FOR SELECT
TO authenticated
USING (public.can_access_document_recipient(id, document_id, auth.uid()));

DROP POLICY IF EXISTS "Recipients can update own row" ON public.document_recipients;
DROP POLICY IF EXISTS "Recipients can update own row" ON public.document_recipients;
CREATE POLICY "Recipients can update own row"
ON public.document_recipients
FOR UPDATE
TO authenticated
USING (public.can_access_document_recipient(id, document_id, auth.uid()))
WITH CHECK (public.can_access_document_recipient(id, document_id, auth.uid()));