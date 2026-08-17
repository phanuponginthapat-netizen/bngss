-- Restrict anon access to cms_settings: exclude ai_bot keys
DROP POLICY IF EXISTS "Anon view public cms keys" ON public.cms_settings;
DROP POLICY IF EXISTS "Anon view public cms keys" ON public.cms_settings;
CREATE POLICY "Anon view public cms keys" ON public.cms_settings
FOR SELECT TO anon
USING (
  (key !~~* 'id_card%')
  AND (key !~~* '%template%')
  AND (key !~~* '%secret%')
  AND (key !~~* '%internal%')
  AND (key !~~* 'admin_%')
  AND (key !~~* '%ai_bot%')
  AND (key !~~* '%webhook%')
  AND (key !~~* '%api_key%')
  AND (key !~~* '%token%')
);

-- Allow eform recipients to read PDFs addressed to them
DROP POLICY IF EXISTS "eform-pdfs recipient can read" ON storage.objects;
DROP POLICY IF EXISTS "eform-pdfs recipient can read" ON storage.objects;
CREATE POLICY "eform-pdfs recipient can read"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'eform-pdfs'
  AND can_access_eform(
    (NULLIF((storage.foldername(name))[1], ''))::uuid,
    auth.uid()
  )
);