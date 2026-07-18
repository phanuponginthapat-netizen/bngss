CREATE OR REPLACE FUNCTION public.auto_create_substitute_on_leave_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  d date;
  teacher_name text;
  sched RECORD;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status <> 'approved') THEN
    SELECT CONCAT(prefix, first_name, ' ', last_name) INTO teacher_name
      FROM public.personnel WHERE id = NEW.personnel_id;

    d := NEW.start_date;
    WHILE d <= NEW.end_date LOOP
      FOR sched IN
        SELECT s.id, s.subject_id, s.classroom_id, s.period, s.day_of_week
        FROM public.schedules s
        JOIN public.personnel p ON p.id = NEW.personnel_id
        WHERE s.teacher_name = CONCAT(p.prefix, p.first_name, ' ', p.last_name)
          AND s.day_of_week = (EXTRACT(DOW FROM d)::int + 6) % 7 + 1
      LOOP
        INSERT INTO public.substitute_teaching
          (original_teacher, substitute_teacher, subject_id, classroom_id, teaching_date, period, status, notes)
        VALUES
          (teacher_name, NULL, sched.subject_id, sched.classroom_id, d,
           'คาบ ' || sched.period, 'pending',
           'สร้างอัตโนมัติจากคำลา ' || NEW.leave_type)
        ON CONFLICT DO NOTHING;
      END LOOP;
      d := d + 1;
    END LOOP;
  END IF;
  RETURN NEW;
END $function$;