CREATE OR REPLACE FUNCTION public.is_eform_sender(_eform_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id = auth.uid()
    AND EXISTS (
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
  SELECT _user_id = auth.uid()
    AND EXISTS (
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

REVOKE ALL ON FUNCTION public.is_eform_sender(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_eform(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_eform_sender(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_eform(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_eform_sender(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.can_access_eform(uuid, uuid) TO service_role;