ALTER TABLE public.exam_questions ADD COLUMN IF NOT EXISTS scoring_mode text NOT NULL DEFAULT 'normal';
ALTER TABLE public.exam_questions DROP CONSTRAINT IF EXISTS exam_questions_scoring_mode_check;
ALTER TABLE public.exam_questions ADD CONSTRAINT exam_questions_scoring_mode_check CHECK (scoring_mode IN ('normal','free','excluded'));
ALTER TABLE public.exam_submissions ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'ok';
ALTER TABLE public.exam_submissions ADD COLUMN IF NOT EXISTS review_reasons text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.exam_submissions ADD COLUMN IF NOT EXISTS gradebook_pushed_at timestamptz;
ALTER TABLE public.exam_submissions DROP CONSTRAINT IF EXISTS exam_submissions_review_status_check;
ALTER TABLE public.exam_submissions ADD CONSTRAINT exam_submissions_review_status_check CHECK (review_status IN ('ok','review'));