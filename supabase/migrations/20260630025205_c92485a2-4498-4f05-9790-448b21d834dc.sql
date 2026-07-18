
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS logo_url text;

CREATE TABLE IF NOT EXISTS public.club_feed_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  body text,
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_feed_posts TO authenticated;
GRANT ALL ON public.club_feed_posts TO service_role;

ALTER TABLE public.club_feed_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feed read for related"
ON public.club_feed_posts FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director')
  OR public.is_club_advisor(auth.uid(), club_id)
  OR EXISTS (
    SELECT 1 FROM public.club_members cm
    JOIN public.students s ON s.id = cm.student_id
    WHERE cm.club_id = club_feed_posts.club_id
      AND cm.status = 'active'
      AND s.auth_user_id = auth.uid()
  )
);

CREATE POLICY "feed insert for related"
ON public.club_feed_posts FOR INSERT
TO authenticated
WITH CHECK (
  author_id = auth.uid() AND (
    has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director')
    OR public.is_club_advisor(auth.uid(), club_id)
    OR EXISTS (
      SELECT 1 FROM public.club_members cm
      JOIN public.students s ON s.id = cm.student_id
      WHERE cm.club_id = club_feed_posts.club_id
        AND cm.status = 'active'
        AND s.auth_user_id = auth.uid()
    )
  )
);

CREATE POLICY "feed update own"
ON public.club_feed_posts FOR UPDATE
TO authenticated
USING (author_id = auth.uid() OR has_role(auth.uid(),'admin') OR public.is_club_advisor(auth.uid(), club_id))
WITH CHECK (author_id = auth.uid() OR has_role(auth.uid(),'admin') OR public.is_club_advisor(auth.uid(), club_id));

CREATE POLICY "feed delete own or staff"
ON public.club_feed_posts FOR DELETE
TO authenticated
USING (author_id = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director') OR public.is_club_advisor(auth.uid(), club_id));

CREATE TRIGGER update_club_feed_posts_updated_at
BEFORE UPDATE ON public.club_feed_posts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.club_feed_posts;
