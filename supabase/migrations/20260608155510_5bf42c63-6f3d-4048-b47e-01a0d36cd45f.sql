-- Allow anon to read ONLY the disabled_modules entry so the public homepage can respect module toggles
CREATE POLICY "Anyone can view disabled_modules"
ON public.school_settings
FOR SELECT
TO anon
USING (setting_key = 'disabled_modules');

GRANT SELECT ON public.school_settings TO anon;