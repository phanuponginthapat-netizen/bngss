-- ลาครูแบบเลือกรายคาบ: leave_scope = 'periods' จะสร้างคาบสอนแทนเฉพาะคาบที่อยู่ใน substitute_plan
ALTER TABLE public.staff_leaves ADD COLUMN IF NOT EXISTS leave_scope text NOT NULL DEFAULT 'full_day';

CREATE OR REPLACE FUNCTION public.auto_create_substitute_on_leave_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  d date; teacher_name text; sched RECORD; dow int; chosen text; in_plan boolean;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status <> 'approved') THEN
    SELECT CONCAT(prefix, first_name, ' ', last_name) INTO teacher_name
      FROM public.personnel WHERE id = NEW.personnel_id;
    d := NEW.start_date;
    WHILE d <= NEW.end_date LOOP
      dow := (EXTRACT(DOW FROM d)::int + 6) % 7 + 1;
      FOR sched IN
        SELECT s.id, s.subject_id, s.classroom_id, s.period FROM public.schedules s
        WHERE s.teacher_name = teacher_name AND s.day_of_week = dow ORDER BY s.period
      LOOP
        SELECT true, NULLIF(TRIM(e->>'teacher'), '') INTO in_plan, chosen
        FROM jsonb_array_elements(COALESCE(NEW.substitute_plan, '[]'::jsonb)) e
        WHERE (e->>'date') = d::text AND (e->>'period')::int = sched.period LIMIT 1;

        IF COALESCE(NEW.leave_scope, 'full_day') = 'periods' AND in_plan IS NULL THEN
          chosen := NULL; in_plan := NULL; CONTINUE;  -- คาบนี้ไม่ได้ลา
        END IF;
        IF chosen IS NULL AND COALESCE(NEW.acting_teacher, '') NOT IN ('', 'none') THEN
          chosen := NEW.acting_teacher;
        END IF;
        IF chosen IS NULL THEN
          chosen := public.pick_auto_substitute(dow, sched.period, NEW.personnel_id, sched.subject_id);
        END IF;
        INSERT INTO public.substitute_teaching
          (original_teacher, substitute_teacher, subject_id, classroom_id, teaching_date, period, status, notes, leave_id)
        VALUES (teacher_name, chosen, sched.subject_id, sched.classroom_id, d, 'คาบ ' || sched.period,
           CASE WHEN chosen IS NULL THEN 'pending' ELSE 'confirmed' END,
           'สร้างอัตโนมัติจากคำลา ' || NEW.leave_type, NEW.id)
        ON CONFLICT (original_teacher, teaching_date, period) DO UPDATE
          SET substitute_teacher = COALESCE(EXCLUDED.substitute_teacher, public.substitute_teaching.substitute_teacher),
              status = CASE WHEN EXCLUDED.substitute_teacher IS NOT NULL THEN 'confirmed' ELSE public.substitute_teaching.status END,
              leave_id = EXCLUDED.leave_id;
        chosen := NULL; in_plan := NULL;
      END LOOP;
      d := d + 1;
    END LOOP;
  END IF;
  RETURN NEW;
END $function$;

NOTIFY pgrst, 'reload schema';
