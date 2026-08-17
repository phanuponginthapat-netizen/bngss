-- Allow public read for social media links (needed to render Social Wall widget on Dashboard/Home)
DROP POLICY IF EXISTS "Anon view social media links" ON public.school_settings;
CREATE POLICY "Anon view social media links"
ON public.school_settings
FOR SELECT
USING (setting_key = 'social_media_links');

-- Allow admins/directors to manage school_settings (all keys)
DROP POLICY IF EXISTS "Admins manage school settings" ON public.school_settings;
CREATE POLICY "Admins manage school settings"
ON public.school_settings
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

-- Allow any authenticated user to read non-sensitive settings
DROP POLICY IF EXISTS "Authenticated read general settings" ON public.school_settings;
CREATE POLICY "Authenticated read general settings"
ON public.school_settings
FOR SELECT
TO authenticated
USING (true);

GRANT SELECT ON public.school_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_settings TO authenticated;
GRANT ALL ON public.school_settings TO service_role;