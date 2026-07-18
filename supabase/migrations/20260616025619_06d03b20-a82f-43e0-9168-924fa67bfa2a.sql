
ALTER TABLE public.pa_agreements
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS part1_d1_score NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS part1_d2_score NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS part1_d3_score NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS part2_score NUMERIC DEFAULT 0;

-- Realtime publication (ignore if already there)
DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.pa_agreements';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END$$;
