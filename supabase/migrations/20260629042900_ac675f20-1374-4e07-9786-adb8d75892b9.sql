
-- 1) Lock down ai_providers / ai_provider_keys api_key column
REVOKE SELECT (api_key) ON public.ai_providers FROM authenticated, anon;
REVOKE SELECT (api_key) ON public.ai_provider_keys FROM authenticated, anon;

-- 2) Tighten google_chat_webhooks SELECT to authenticated role explicitly
DROP POLICY IF EXISTS "Admins view webhooks" ON public.google_chat_webhooks;
CREATE POLICY "Admins view webhooks"
  ON public.google_chat_webhooks
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role));

-- 3) Restrict sar-evidences storage to staff roles
DROP POLICY IF EXISTS sar_evidences_authenticated_read ON storage.objects;
DROP POLICY IF EXISTS sar_evidences_authenticated_insert ON storage.objects;
DROP POLICY IF EXISTS sar_evidences_authenticated_update ON storage.objects;
DROP POLICY IF EXISTS sar_evidences_authenticated_delete ON storage.objects;

CREATE POLICY sar_evidences_staff_read
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'sar-evidences' AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'director'::app_role)
      OR has_role(auth.uid(), 'teacher'::app_role)
      OR owner = auth.uid()
    )
  );

CREATE POLICY sar_evidences_staff_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'sar-evidences' AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'director'::app_role)
      OR has_role(auth.uid(), 'teacher'::app_role)
    )
  );

CREATE POLICY sar_evidences_staff_update
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'sar-evidences' AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'director'::app_role)
      OR owner = auth.uid()
    )
  );

CREATE POLICY sar_evidences_staff_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'sar-evidences' AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'director'::app_role)
      OR owner = auth.uid()
    )
  );
