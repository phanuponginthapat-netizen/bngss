-- 1) FK columns
ALTER TABLE public.classrooms
  ADD COLUMN IF NOT EXISTS homeroom_teacher_id uuid REFERENCES public.personnel(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS homeroom_teacher_2_id uuid REFERENCES public.personnel(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_classrooms_homeroom_teacher_id ON public.classrooms(homeroom_teacher_id);
CREATE INDEX IF NOT EXISTS idx_classrooms_homeroom_teacher_2_id ON public.classrooms(homeroom_teacher_2_id);

-- 2) Backfill homeroom_teacher_id from string match
UPDATE public.classrooms c
SET homeroom_teacher_id = p.id
FROM public.personnel p
WHERE c.homeroom_teacher_id IS NULL
  AND c.homeroom_teacher IS NOT NULL
  AND (
    c.homeroom_teacher = CONCAT(COALESCE(p.prefix,''), p.first_name, ' ', p.last_name)
    OR c.homeroom_teacher = CONCAT(p.first_name, ' ', p.last_name)
    OR c.homeroom_teacher = CONCAT(p.prefix, p.first_name)
    OR c.homeroom_teacher = p.first_name
  );

UPDATE public.classrooms c
SET homeroom_teacher_2_id = p.id
FROM public.personnel p
WHERE c.homeroom_teacher_2_id IS NULL
  AND c.homeroom_teacher_2 IS NOT NULL
  AND (
    c.homeroom_teacher_2 = CONCAT(COALESCE(p.prefix,''), p.first_name, ' ', p.last_name)
    OR c.homeroom_teacher_2 = CONCAT(p.first_name, ' ', p.last_name)
    OR c.homeroom_teacher_2 = CONCAT(p.prefix, p.first_name)
    OR c.homeroom_teacher_2 = p.first_name
  );

-- 3) Keep homeroom_teacher text in sync with FK (for back-compat with old UI bits)
CREATE OR REPLACE FUNCTION public.sync_classroom_homeroom_text()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_name text;
BEGIN
  IF NEW.homeroom_teacher_id IS DISTINCT FROM OLD.homeroom_teacher_id THEN
    IF NEW.homeroom_teacher_id IS NULL THEN
      NEW.homeroom_teacher := NULL;
    ELSE
      SELECT CONCAT(COALESCE(prefix,''), first_name, ' ', last_name)
        INTO v_name FROM public.personnel WHERE id = NEW.homeroom_teacher_id;
      NEW.homeroom_teacher := v_name;
    END IF;
  END IF;
  IF NEW.homeroom_teacher_2_id IS DISTINCT FROM OLD.homeroom_teacher_2_id THEN
    IF NEW.homeroom_teacher_2_id IS NULL THEN
      NEW.homeroom_teacher_2 := NULL;
    ELSE
      SELECT CONCAT(COALESCE(prefix,''), first_name, ' ', last_name)
        INTO v_name FROM public.personnel WHERE id = NEW.homeroom_teacher_2_id;
      NEW.homeroom_teacher_2 := v_name;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_classroom_homeroom_text ON public.classrooms;
CREATE TRIGGER trg_sync_classroom_homeroom_text
BEFORE UPDATE ON public.classrooms
FOR EACH ROW EXECUTE FUNCTION public.sync_classroom_homeroom_text();

-- 4) Backfill schedules.teacher_id from teacher_name (old rows)
UPDATE public.schedules s
SET teacher_id = p.id
FROM public.personnel p
WHERE s.teacher_id IS NULL
  AND s.teacher_name IS NOT NULL
  AND (
    s.teacher_name = CONCAT(COALESCE(p.prefix,''), p.first_name, ' ', p.last_name)
    OR s.teacher_name = CONCAT(p.first_name, ' ', p.last_name)
    OR s.teacher_name = CONCAT('ครู', p.first_name)
    OR s.teacher_name = p.first_name
    OR REPLACE(s.teacher_name, ' ', '') = REPLACE(CONCAT(COALESCE(p.prefix,''), p.first_name, p.last_name), ' ', '')
  );