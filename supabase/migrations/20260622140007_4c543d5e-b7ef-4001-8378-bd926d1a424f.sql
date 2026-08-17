ALTER PUBLICATION supabase_realtime DROP TABLE public.profiles;
ALTER PUBLICATION supabase_realtime DROP TABLE public.students;
ALTER PUBLICATION supabase_realtime DROP TABLE public.pdpa_consents;

DROP POLICY IF EXISTS "Admin/director manage ai_providers" ON public.ai_providers;
DROP POLICY IF EXISTS "service_role only ai_providers" ON public.ai_providers;
CREATE POLICY "service_role only ai_providers" ON public.ai_providers
  AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can view cms settings" ON public.cms_settings;
DROP POLICY IF EXISTS "Anon view public cms keys" ON public.cms_settings;
CREATE POLICY "Anon view public cms keys" ON public.cms_settings
  FOR SELECT TO anon
  USING (key NOT ILIKE 'id_card%' AND key NOT ILIKE '%template%' AND key NOT ILIKE '%secret%' AND key NOT ILIKE '%internal%' AND key NOT ILIKE 'admin_%');
DROP POLICY IF EXISTS "Auth view all cms settings" ON public.cms_settings;
CREATE POLICY "Auth view all cms settings" ON public.cms_settings
  FOR SELECT TO authenticated USING (true);