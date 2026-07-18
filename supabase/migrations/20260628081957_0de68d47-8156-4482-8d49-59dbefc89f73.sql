
ALTER TABLE public.news_posts
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'all';

ALTER TABLE public.news_posts
  ADD CONSTRAINT news_posts_audience_check
  CHECK (audience IN ('all','staff','students','parents','alumni'));

-- Helper: can the current user see a news post with given audience?
CREATE OR REPLACE FUNCTION public.user_can_view_news_audience(_audience text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _audience IS NULL OR _audience = 'all' THEN true
    WHEN _audience = 'staff' THEN
      public.has_role(auth.uid(),'admin')
      OR public.has_role(auth.uid(),'director')
      OR public.has_role(auth.uid(),'teacher')
    WHEN _audience = 'students' THEN public.has_role(auth.uid(),'student')
    WHEN _audience = 'parents' THEN public.has_role(auth.uid(),'parent')
    WHEN _audience = 'alumni' THEN public.has_role(auth.uid(),'alumni')
    ELSE false
  END;
$$;

REVOKE EXECUTE ON FUNCTION public.user_can_view_news_audience(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_can_view_news_audience(text) TO authenticated;

-- Replace authenticated-published SELECT policy to honor audience
DROP POLICY IF EXISTS "Authenticated can view published news" ON public.news_posts;
CREATE POLICY "Authenticated can view published news"
  ON public.news_posts FOR SELECT
  TO authenticated
  USING (
    is_published = true
    AND public.user_can_view_news_audience(audience)
  );

-- Public (anon) can only see 'all' audience published news
DROP POLICY IF EXISTS "Public can view published news" ON public.news_posts;
CREATE POLICY "Public can view published news"
  ON public.news_posts FOR SELECT
  TO anon
  USING (
    is_published = true
    AND (audience IS NULL OR audience = 'all')
  );
