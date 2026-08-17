
-- 1) ai_provider_keys: explicit restrictive SELECT requiring admin/director
DROP POLICY IF EXISTS "Restrict ai_provider_keys SELECT to admin/director" ON public.ai_provider_keys;
DROP POLICY IF EXISTS "Restrict ai_provider_keys SELECT to admin/director" ON public.ai_provider_keys;
CREATE POLICY "Restrict ai_provider_keys SELECT to admin/director"
ON public.ai_provider_keys
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role));

-- 2) district_snapshots: tighten restrictive policy so NULL school_id is not readable by school admins
DROP POLICY IF EXISTS "school_scope_restrictive" ON public.district_snapshots;
DROP POLICY IF EXISTS "school_scope_restrictive" ON public.district_snapshots;
CREATE POLICY "school_scope_restrictive"
ON public.district_snapshots
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (school_id IS NOT NULL AND school_id = get_user_school_id(auth.uid()))
WITH CHECK (school_id IS NOT NULL AND school_id = get_user_school_id(auth.uid()));

-- 3) eform-pdfs storage: require ownership or admin/director
DROP POLICY IF EXISTS "Authenticated read eform pdfs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update eform pdfs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete eform pdfs" ON storage.objects;

DROP POLICY IF EXISTS "eform-pdfs owner or admin read" ON storage.objects;
DROP POLICY IF EXISTS "eform-pdfs owner or admin read" ON storage.objects;
CREATE POLICY "eform-pdfs owner or admin read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'eform-pdfs'
  AND (
    owner = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'director'::app_role)
  )
);

DROP POLICY IF EXISTS "eform-pdfs owner or admin update" ON storage.objects;
DROP POLICY IF EXISTS "eform-pdfs owner or admin update" ON storage.objects;
CREATE POLICY "eform-pdfs owner or admin update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'eform-pdfs'
  AND (
    owner = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'director'::app_role)
  )
)
WITH CHECK (
  bucket_id = 'eform-pdfs'
  AND (
    owner = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'director'::app_role)
  )
);

DROP POLICY IF EXISTS "eform-pdfs owner or admin delete" ON storage.objects;
DROP POLICY IF EXISTS "eform-pdfs owner or admin delete" ON storage.objects;
CREATE POLICY "eform-pdfs owner or admin delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'eform-pdfs'
  AND (
    owner = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'director'::app_role)
  )
);
