
-- 1) Enum for subject group positions
DO $$ BEGIN
  CREATE TYPE public.subject_group_position AS ENUM ('head','deputy','secretary');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Add position column (defaults to 'head' to preserve existing semantics)
ALTER TABLE public.subject_group_heads
  ADD COLUMN IF NOT EXISTS position public.subject_group_position NOT NULL DEFAULT 'head';

-- 3) Loosen the unique constraint to allow multiple positions per (group, user) -> not needed,
--    same user shouldn't appear twice in same group; keep unique(subject_group, user_id) as-is.

-- 4) Helper to check subject group position rank
CREATE OR REPLACE FUNCTION public.has_subject_group_position(
  _user_id uuid,
  _group text,
  _min_position public.subject_group_position DEFAULT 'secretary'
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subject_group_heads
    WHERE user_id = _user_id
      AND subject_group = _group
      AND (
        CASE position
          WHEN 'head' THEN 3
          WHEN 'deputy' THEN 2
          WHEN 'secretary' THEN 1
        END
      ) >= (
        CASE _min_position
          WHEN 'head' THEN 3
          WHEN 'deputy' THEN 2
          WHEN 'secretary' THEN 1
        END
      )
  );
$$;
