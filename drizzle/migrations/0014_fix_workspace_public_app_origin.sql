CREATE OR REPLACE FUNCTION public.app_base_url()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$ SELECT 'https://bngss.lovable.app'::text; $fn$;
GRANT EXECUTE ON FUNCTION public.app_base_url() TO anon, authenticated, service_role;
COMMENT ON FUNCTION public.app_base_url() IS 'Canonical public app origin for LINE links; retired workspace preview addresses are never used.';