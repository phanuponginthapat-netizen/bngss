
-- 1. Restrict cms_settings public read: exclude any key that looks sensitive
DROP POLICY IF EXISTS "Anyone can view cms settings" ON public.cms_settings;
CREATE POLICY "Public can view non-sensitive cms settings"
ON public.cms_settings
FOR SELECT
TO anon, authenticated
USING (
  key !~* '(secret|token|api[_-]?key|webhook|password|private|credential)'
);

-- 2. Lock down mou-files storage bucket to admin/director only
DROP POLICY IF EXISTS "mou_read" ON storage.objects;
DROP POLICY IF EXISTS "mou_update" ON storage.objects;
DROP POLICY IF EXISTS "mou_insert" ON storage.objects;

CREATE POLICY "mou_read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'mou-files'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'director'::app_role))
);

CREATE POLICY "mou_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'mou-files'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'director'::app_role))
)
WITH CHECK (
  bucket_id = 'mou-files'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'director'::app_role))
);

CREATE POLICY "mou_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'mou-files'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'director'::app_role))
);
