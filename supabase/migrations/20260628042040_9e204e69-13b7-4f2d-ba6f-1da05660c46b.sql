ALTER TABLE public.news_posts
  ADD COLUMN IF NOT EXISTS pin_order smallint,
  ADD COLUMN IF NOT EXISTS cover_image_url text,
  ADD COLUMN IF NOT EXISTS link_url text;

-- enforce that pin_order is 1..3 only
ALTER TABLE public.news_posts DROP CONSTRAINT IF EXISTS news_posts_pin_order_check;
ALTER TABLE public.news_posts
  ADD CONSTRAINT news_posts_pin_order_check CHECK (pin_order IS NULL OR pin_order BETWEEN 1 AND 3);

CREATE INDEX IF NOT EXISTS idx_news_posts_pin_order ON public.news_posts(pin_order) WHERE pin_order IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activity_matches_scheduled_at ON public.activity_matches(scheduled_at);