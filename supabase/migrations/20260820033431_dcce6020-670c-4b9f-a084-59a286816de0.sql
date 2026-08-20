-- Sync "วิชาที่สอน" (teacher_assignments) from the class timetable (schedules)
INSERT INTO public.teacher_assignments (personnel_id, subject_id, classroom_id, academic_year, semester)
SELECT DISTINCT s.teacher_id, s.subject_id, s.classroom_id,
       COALESCE(s.academic_year, EXTRACT(year FROM now())::int),
       COALESCE(s.semester, 1)
FROM public.schedules s
WHERE s.teacher_id IS NOT NULL
  AND s.subject_id IS NOT NULL
  AND s.classroom_id IS NOT NULL
ON CONFLICT (personnel_id, subject_id, classroom_id, academic_year, semester) DO NOTHING;

CREATE OR REPLACE FUNCTION public.sync_teacher_assignment_from_schedule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.teacher_id IS NOT NULL AND NEW.subject_id IS NOT NULL AND NEW.classroom_id IS NOT NULL THEN
    INSERT INTO public.teacher_assignments (personnel_id, subject_id, classroom_id, academic_year, semester)
    VALUES (NEW.teacher_id, NEW.subject_id, NEW.classroom_id,
            COALESCE(NEW.academic_year, EXTRACT(year FROM now())::int),
            COALESCE(NEW.semester, 1))
    ON CONFLICT (personnel_id, subject_id, classroom_id, academic_year, semester) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_teacher_assignment ON public.schedules;
CREATE TRIGGER trg_sync_teacher_assignment
AFTER INSERT OR UPDATE OF teacher_id, subject_id, classroom_id ON public.schedules
FOR EACH ROW EXECUTE FUNCTION public.sync_teacher_assignment_from_schedule();