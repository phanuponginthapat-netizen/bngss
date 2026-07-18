REVOKE ALL ON FUNCTION public.is_document_recipient(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_document_recipient(uuid, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_document_owner(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_document_recipient(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_document_recipient(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_document_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_document_recipient(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.can_access_document_recipient(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_document_owner(uuid, uuid) TO service_role;