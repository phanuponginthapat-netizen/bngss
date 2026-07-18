
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dept_position') THEN
    CREATE TYPE public.dept_position AS ENUM ('head', 'deputy', 'assistant', 'member');
  END IF;
END $$;

ALTER TABLE public.user_departments
  ADD COLUMN IF NOT EXISTS position public.dept_position NOT NULL DEFAULT 'member';

-- Backfill: existing is_head=true rows → 'head'
UPDATE public.user_departments
SET position = 'head'
WHERE is_head = true AND position = 'member';

-- Keep is_head in sync with position via trigger (backward compat for existing code)
CREATE OR REPLACE FUNCTION public.sync_user_dept_is_head()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.is_head := (NEW.position = 'head');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_user_dept_is_head ON public.user_departments;
CREATE TRIGGER trg_sync_user_dept_is_head
  BEFORE INSERT OR UPDATE ON public.user_departments
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_dept_is_head();

-- Helper for RLS: check a user holds a specific position (or higher) in a department
CREATE OR REPLACE FUNCTION public.has_dept_position(
  _user_id uuid,
  _department public.school_department,
  _min_position public.dept_position DEFAULT 'member'
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_departments
    WHERE user_id = _user_id
      AND department = _department
      AND CASE _min_position
        WHEN 'member'    THEN true
        WHEN 'assistant' THEN position IN ('assistant', 'deputy', 'head')
        WHEN 'deputy'    THEN position IN ('deputy', 'head')
        WHEN 'head'      THEN position = 'head'
      END
  );
$$;
