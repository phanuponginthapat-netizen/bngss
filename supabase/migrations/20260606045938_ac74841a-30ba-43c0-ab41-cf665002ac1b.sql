
-- Tighten news_posts: authenticated users only see published; staff can see drafts
DROP POLICY IF EXISTS "Anyone authenticated can view news" ON public.news_posts;

DROP POLICY IF EXISTS "Authenticated can view published news" ON public.news_posts;
CREATE POLICY "Authenticated can view published news"
ON public.news_posts FOR SELECT TO authenticated
USING (is_published = true);

DROP POLICY IF EXISTS "Staff can view all news" ON public.news_posts;
CREATE POLICY "Staff can view all news"
ON public.news_posts FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'director'::app_role)
  OR has_role(auth.uid(), 'teacher'::app_role)
  OR author_id = auth.uid()
);
