-- Add author_id to track ownership for teacher self-management
ALTER TABLE public.news_posts ADD COLUMN IF NOT EXISTS author_id uuid;
ALTER TABLE public.emergency_broadcasts ADD COLUMN IF NOT EXISTS author_id uuid;

-- ===== news_posts policies =====
ALTER TABLE public.news_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can view news" ON public.news_posts;
CREATE POLICY "Anyone authenticated can view news"
ON public.news_posts FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Public can view published news" ON public.news_posts;
CREATE POLICY "Public can view published news"
ON public.news_posts FOR SELECT
TO anon
USING (is_published = true);

DROP POLICY IF EXISTS "Staff can create news" ON public.news_posts;
CREATE POLICY "Staff can create news"
ON public.news_posts FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'director'::app_role)
  OR has_role(auth.uid(), 'teacher'::app_role)
);

DROP POLICY IF EXISTS "Author or admin can update news" ON public.news_posts;
CREATE POLICY "Author or admin can update news"
ON public.news_posts FOR UPDATE
TO authenticated
USING (
  author_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'director'::app_role)
)
WITH CHECK (
  author_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'director'::app_role)
);

DROP POLICY IF EXISTS "Author or admin can delete news" ON public.news_posts;
CREATE POLICY "Author or admin can delete news"
ON public.news_posts FOR DELETE
TO authenticated
USING (
  author_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'director'::app_role)
);

-- ===== emergency_broadcasts policies =====
DROP POLICY IF EXISTS "Admin/Director can manage emergency_broadcasts" ON public.emergency_broadcasts;

DROP POLICY IF EXISTS "Staff can create emergency_broadcasts" ON public.emergency_broadcasts;
CREATE POLICY "Staff can create emergency_broadcasts"
ON public.emergency_broadcasts FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'director'::app_role)
  OR has_role(auth.uid(), 'teacher'::app_role)
);

DROP POLICY IF EXISTS "Author or admin can update emergency" ON public.emergency_broadcasts;
CREATE POLICY "Author or admin can update emergency"
ON public.emergency_broadcasts FOR UPDATE
TO authenticated
USING (
  author_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'director'::app_role)
)
WITH CHECK (
  author_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'director'::app_role)
);

DROP POLICY IF EXISTS "Author or admin can delete emergency" ON public.emergency_broadcasts;
CREATE POLICY "Author or admin can delete emergency"
ON public.emergency_broadcasts FOR DELETE
TO authenticated
USING (
  author_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'director'::app_role)
);