
REVOKE ALL ON FUNCTION public.is_eform_sender(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_eform_recipient(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_eform_sender(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_eform_recipient(uuid, uuid) TO authenticated, service_role;
