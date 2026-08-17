
-- 1. chat_reports: fix reflexive WITH CHECK
DROP POLICY IF EXISTS "admin updates reports" ON public.chat_reports;
CREATE POLICY "admin updates reports" ON public.chat_reports
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    AND reporter_id = (SELECT reporter_id FROM public.chat_reports WHERE id = chat_reports.id)
  );

-- 2. notifications: DELETE scoped to authenticated
DROP POLICY IF EXISTS "Users delete own notifications" ON public.notifications;
CREATE POLICY "Users delete own notifications" ON public.notifications
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 3. salary_records: scope dept-head policies to authenticated
DROP POLICY IF EXISTS "Personnel dept head can delete salary_records" ON public.salary_records;
DROP POLICY IF EXISTS "Personnel dept head can insert salary_records" ON public.salary_records;
DROP POLICY IF EXISTS "Personnel dept head can update salary_records" ON public.salary_records;
DROP POLICY IF EXISTS "Personnel dept head can view salary_records" ON public.salary_records;

CREATE POLICY "Personnel dept head can view salary_records" ON public.salary_records
  FOR SELECT TO authenticated
  USING (has_dept_position(auth.uid(), 'personnel'::school_department, 'head'::dept_position));
CREATE POLICY "Personnel dept head can insert salary_records" ON public.salary_records
  FOR INSERT TO authenticated
  WITH CHECK (has_dept_position(auth.uid(), 'personnel'::school_department, 'head'::dept_position));
CREATE POLICY "Personnel dept head can update salary_records" ON public.salary_records
  FOR UPDATE TO authenticated
  USING (has_dept_position(auth.uid(), 'personnel'::school_department, 'head'::dept_position))
  WITH CHECK (has_dept_position(auth.uid(), 'personnel'::school_department, 'head'::dept_position));
CREATE POLICY "Personnel dept head can delete salary_records" ON public.salary_records
  FOR DELETE TO authenticated
  USING (has_dept_position(auth.uid(), 'personnel'::school_department, 'head'::dept_position));

-- 4. social_posts: hide raw/page_id from anon; expose safe fields via view
DROP POLICY IF EXISTS "Public can read published social posts" ON public.social_posts;
DROP POLICY IF EXISTS "Authenticated can read published social posts" ON public.social_posts;
CREATE POLICY "Authenticated can read published social posts" ON public.social_posts
  FOR SELECT TO authenticated
  USING (posted_at IS NOT NULL);

CREATE OR REPLACE VIEW public.social_posts_public
WITH (security_invoker = true) AS
SELECT id, platform, external_id, content, media_urls, thumbnail_url,
       permalink, posted_at, created_at
FROM public.social_posts
WHERE posted_at IS NOT NULL;

GRANT SELECT ON public.social_posts_public TO anon, authenticated;
