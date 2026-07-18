-- เพิ่มฟิลด์ teaching_level ให้ personnel + auto-classify จาก schedules
ALTER TABLE public.personnel ADD COLUMN IF NOT EXISTS teaching_level text;

-- function คำนวณ level จาก schedules + classrooms
CREATE OR REPLACE FUNCTION public.recompute_personnel_teaching_level()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  WITH agg AS (
    SELECT s.teacher_id,
      bool_or(c.grade_level LIKE 'ป.%' OR c.grade_level LIKE 'อ.%') AS has_pri,
      bool_or(c.grade_level LIKE 'ม.%') AS has_sec
    FROM public.schedules s
    JOIN public.classrooms c ON c.id = s.classroom_id
    WHERE s.teacher_id IS NOT NULL
    GROUP BY s.teacher_id
  )
  UPDATE public.personnel p
  SET teaching_level = CASE
    WHEN a.has_pri AND a.has_sec THEN 'both'
    WHEN a.has_sec THEN 'secondary'
    WHEN a.has_pri THEN 'primary'
    ELSE p.teaching_level
  END
  FROM agg a
  WHERE p.id = a.teacher_id;
END;
$$;

-- backfill ทันที
SELECT public.recompute_personnel_teaching_level();

-- trigger: เมื่อ schedules เปลี่ยน → recompute (debounced via single-row trigger)
CREATE OR REPLACE FUNCTION public.trg_schedule_update_teacher_level()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tid uuid;
BEGIN
  tid := COALESCE(NEW.teacher_id, OLD.teacher_id);
  IF tid IS NULL THEN RETURN NEW; END IF;
  WITH agg AS (
    SELECT bool_or(c.grade_level LIKE 'ป.%' OR c.grade_level LIKE 'อ.%') AS has_pri,
           bool_or(c.grade_level LIKE 'ม.%') AS has_sec
    FROM public.schedules s
    JOIN public.classrooms c ON c.id = s.classroom_id
    WHERE s.teacher_id = tid
  )
  UPDATE public.personnel p
  SET teaching_level = CASE
    WHEN a.has_pri AND a.has_sec THEN 'both'
    WHEN a.has_sec THEN 'secondary'
    WHEN a.has_pri THEN 'primary'
    ELSE NULL
  END
  FROM agg a
  WHERE p.id = tid;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS schedule_update_teacher_level ON public.schedules;
CREATE TRIGGER schedule_update_teacher_level
AFTER INSERT OR UPDATE OR DELETE ON public.schedules
FOR EACH ROW EXECUTE FUNCTION public.trg_schedule_update_teacher_level();