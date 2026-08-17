
-- Fix leave-attachments storage bucket: scope to owner folder + admin/director
DROP POLICY IF EXISTS "authenticated read leave-attachments" ON storage.objects;
DROP POLICY IF EXISTS "authenticated upload leave-attachments" ON storage.objects;
DROP POLICY IF EXISTS "authenticated update leave-attachments" ON storage.objects;
DROP POLICY IF EXISTS "authenticated delete leave-attachments" ON storage.objects;

DROP POLICY IF EXISTS "leave-attachments owner or staff read" ON storage.objects;
DROP POLICY IF EXISTS "leave-attachments owner or staff read" ON storage.objects;
CREATE POLICY "leave-attachments owner or staff read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'leave-attachments'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'director'::app_role)
  )
);

DROP POLICY IF EXISTS "leave-attachments owner upload" ON storage.objects;
DROP POLICY IF EXISTS "leave-attachments owner upload" ON storage.objects;
CREATE POLICY "leave-attachments owner upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'leave-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "leave-attachments owner or admin update" ON storage.objects;
DROP POLICY IF EXISTS "leave-attachments owner or admin update" ON storage.objects;
CREATE POLICY "leave-attachments owner or admin update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'leave-attachments'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'director'::app_role)
  )
);

DROP POLICY IF EXISTS "leave-attachments owner or admin delete" ON storage.objects;
DROP POLICY IF EXISTS "leave-attachments owner or admin delete" ON storage.objects;
CREATE POLICY "leave-attachments owner or admin delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'leave-attachments'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'director'::app_role)
  )
);

-- Fix substitute-proof storage bucket: staff-only access
DROP POLICY IF EXISTS "substitute-proof read auth" ON storage.objects;
DROP POLICY IF EXISTS "substitute-proof insert auth" ON storage.objects;
DROP POLICY IF EXISTS "substitute-proof update auth" ON storage.objects;
DROP POLICY IF EXISTS "substitute-proof delete auth" ON storage.objects;

DROP POLICY IF EXISTS "substitute-proof staff read" ON storage.objects;
DROP POLICY IF EXISTS "substitute-proof staff read" ON storage.objects;
CREATE POLICY "substitute-proof staff read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'substitute-proof'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'director'::app_role)
    OR has_role(auth.uid(), 'teacher'::app_role)
    OR owner = auth.uid()
  )
);

DROP POLICY IF EXISTS "substitute-proof staff insert" ON storage.objects;
DROP POLICY IF EXISTS "substitute-proof staff insert" ON storage.objects;
CREATE POLICY "substitute-proof staff insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'substitute-proof'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'director'::app_role)
    OR has_role(auth.uid(), 'teacher'::app_role)
  )
);

DROP POLICY IF EXISTS "substitute-proof owner or admin update" ON storage.objects;
DROP POLICY IF EXISTS "substitute-proof owner or admin update" ON storage.objects;
CREATE POLICY "substitute-proof owner or admin update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'substitute-proof'
  AND (
    owner = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'director'::app_role)
  )
);

DROP POLICY IF EXISTS "substitute-proof owner or admin delete" ON storage.objects;
DROP POLICY IF EXISTS "substitute-proof owner or admin delete" ON storage.objects;
CREATE POLICY "substitute-proof owner or admin delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'substitute-proof'
  AND (
    owner = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'director'::app_role)
  )
);

-- Fix wall_post_comments read: scope by parent post visibility
DROP POLICY IF EXISTS "comments read" ON public.wall_post_comments;

DROP POLICY IF EXISTS "comments read scoped by post" ON public.wall_post_comments;
DROP POLICY IF EXISTS "comments read scoped by post" ON public.wall_post_comments;
CREATE POLICY "comments read scoped by post" ON public.wall_post_comments
FOR SELECT TO authenticated
USING (
  post_id IN (
    SELECT id FROM public.wall_posts
    WHERE visibility = 'public'
       OR (visibility = ANY (ARRAY['school'::text, 'public'::text])
           AND (school_id IS NULL OR school_id = get_user_school_id(auth.uid())))
       OR author_id = auth.uid()
  )
);
