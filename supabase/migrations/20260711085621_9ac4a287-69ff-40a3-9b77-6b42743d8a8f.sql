
-- 1) Remove observer read access to exam answer keys and student submissions
DROP POLICY IF EXISTS "Observers can view" ON public.exam_questions;
DROP POLICY IF EXISTS "Observers can view" ON public.exam_submissions;

-- 2) Scope garbage_deposits staff reads to same school as the student (restrictive)
CREATE POLICY "garbage_deposits_school_scope"
  ON public.garbage_deposits
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR student_id IS NULL
    OR public.student_in_user_school(student_id)
  );

-- 3) Hide raw social payload from public; only expose safe columns
REVOKE SELECT ON public.social_posts FROM anon, authenticated;
GRANT SELECT (id, platform, external_id, page_id, content, media_urls, thumbnail_url, permalink, posted_at, created_at)
  ON public.social_posts TO anon, authenticated;
-- Restore full column access for authenticated users that pass other policies (admin writers etc.) via service_role only
GRANT ALL ON public.social_posts TO service_role;
