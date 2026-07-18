
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS results_published boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS results_published_at timestamptz;

ALTER TABLE public.activity_scores
  ADD COLUMN IF NOT EXISTS criteria_scores jsonb NOT NULL DEFAULT '{}'::jsonb;
