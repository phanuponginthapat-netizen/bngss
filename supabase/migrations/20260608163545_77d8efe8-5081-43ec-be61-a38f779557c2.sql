
REVOKE SELECT (api_key) ON public.ai_provider_keys FROM anon, authenticated;
REVOKE SELECT (api_key) ON public.ai_integrations FROM anon, authenticated;

ALTER PUBLICATION supabase_realtime DROP TABLE public.ai_chat_logs;
ALTER PUBLICATION supabase_realtime DROP TABLE public.face_scan_logs;

DROP POLICY IF EXISTS "portfolio read auth" ON storage.objects;
DROP POLICY IF EXISTS "portfolio read own or public" ON storage.objects;
DROP POLICY IF EXISTS "portfolio read own or public" ON storage.objects;
CREATE POLICY "portfolio read own or public"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'portfolio'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.portfolio_items pi
      WHERE pi.media_url LIKE '%' || storage.objects.name || '%'
        AND (
          pi.visibility = 'public'
          OR (pi.visibility = 'school' AND (pi.school_id IS NULL OR pi.school_id = public.get_user_school_id(auth.uid())))
          OR pi.user_id = auth.uid()
        )
    )
  )
);

DROP POLICY IF EXISTS "wall read auth" ON storage.objects;
DROP POLICY IF EXISTS "wall read scoped" ON storage.objects;
DROP POLICY IF EXISTS "wall read scoped" ON storage.objects;
CREATE POLICY "wall read scoped"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'wall-media'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.wall_posts wp
      WHERE EXISTS (SELECT 1 FROM unnest(wp.media_urls) AS u WHERE u LIKE '%' || storage.objects.name || '%')
        AND (
          wp.visibility = 'public'
          OR (wp.visibility = 'school' AND (wp.school_id IS NULL OR wp.school_id = public.get_user_school_id(auth.uid())))
          OR wp.author_id = auth.uid()
        )
    )
  )
);
