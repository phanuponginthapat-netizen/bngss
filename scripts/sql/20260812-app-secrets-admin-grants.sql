GRANT SELECT, INSERT, UPDATE ON public.app_secrets TO authenticated;
DELETE FROM public.app_secrets WHERE key = 'GOOGLE_OAUTH_CLIENT_ID_TEST';
