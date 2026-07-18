
CREATE TABLE IF NOT EXISTS public.social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL DEFAULT 'facebook',
  external_id text NOT NULL,
  page_id text,
  content text,
  media_urls text[] DEFAULT ARRAY[]::text[],
  thumbnail_url text,
  permalink text,
  posted_at timestamptz,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  broadcasted_at timestamptz,
  broadcast_error text,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform, external_id)
);

CREATE INDEX IF NOT EXISTS idx_social_posts_posted_at ON public.social_posts (posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_posts_platform ON public.social_posts (platform);

ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;

-- Public can read (for homepage)
CREATE POLICY "Public can read social posts"
  ON public.social_posts FOR SELECT
  USING (true);

-- Admin/director can delete
CREATE POLICY "Admin/director can delete social posts"
  ON public.social_posts FOR DELETE
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

-- Admin/director can update (e.g. hide)
CREATE POLICY "Admin/director can update social posts"
  ON public.social_posts FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.social_posts;
