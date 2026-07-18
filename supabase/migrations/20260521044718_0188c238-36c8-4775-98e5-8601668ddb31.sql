
-- 1) Add teacher_id column
ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS teacher_id uuid REFERENCES public.personnel(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_schedules_teacher_id ON public.schedules(teacher_id);
CREATE INDEX IF NOT EXISTS idx_schedules_teacher_year_sem ON public.schedules(teacher_id, academic_year, semester);

-- 2) Trigger function to auto-fill teacher_id from teacher_name
CREATE OR REPLACE FUNCTION public.fill_schedule_teacher_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  found_id uuid;
  fname text;
BEGIN
  IF NEW.teacher_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.teacher_name IS NULL OR length(trim(NEW.teacher_name)) = 0 THEN
    RETURN NEW;
  END IF;

  -- Strip leading "ครู" / prefix to get first name token
  fname := regexp_replace(NEW.teacher_name, '^(ครู|นาย|นาง|นางสาว|น\.ส\.|ดร\.|อ\.)\s*', '');
  fname := split_part(fname, ' ', 1);

  -- 1. Exact full name match: "<prefix><first> <last>"
  SELECT id INTO found_id FROM public.personnel
   WHERE status = 'active'
     AND (COALESCE(prefix,'') || first_name || ' ' || COALESCE(last_name,'')) = NEW.teacher_name
   LIMIT 1;

  -- 2. Match by "ครู<first_name>"
  IF found_id IS NULL THEN
    SELECT id INTO found_id FROM public.personnel
     WHERE status = 'active' AND first_name = fname
     LIMIT 1;
  END IF;

  NEW.teacher_id := found_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fill_schedule_teacher_id ON public.schedules;
CREATE TRIGGER trg_fill_schedule_teacher_id
BEFORE INSERT OR UPDATE OF teacher_name, teacher_id ON public.schedules
FOR EACH ROW EXECUTE FUNCTION public.fill_schedule_teacher_id();

-- 3) Backfill existing rows
UPDATE public.schedules s
SET teacher_id = p.id
FROM public.personnel p
WHERE s.teacher_id IS NULL
  AND s.teacher_name IS NOT NULL
  AND (
    (COALESCE(p.prefix,'') || p.first_name || ' ' || COALESCE(p.last_name,'')) = s.teacher_name
    OR p.first_name = regexp_replace(s.teacher_name, '^(ครู|นาย|นาง|นางสาว|น\.ส\.|ดร\.|อ\.)\s*', '')
    OR ('ครู' || p.first_name) = s.teacher_name
  );
