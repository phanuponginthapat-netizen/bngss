CREATE OR REPLACE FUNCTION public.substitute_is_free(_name text, _date date, _period integer, _exclude_leave uuid DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH t AS (SELECT * FROM public.term_for_date(_date))
  SELECT NOT EXISTS (
      SELECT 1 FROM public.schedules s, t
      WHERE s.day_of_week = (EXTRACT(DOW FROM _date)::int + 6) % 7 + 1
        AND s.period = _period AND s.academic_year = t.year_ce AND s.semester = t.semester
        AND s.teacher_name = _name)
    AND NOT EXISTS (
      SELECT 1 FROM public.staff_leaves sl JOIN public.personnel p ON p.id = sl.personnel_id
      WHERE CONCAT(p.prefix, p.first_name, ' ', p.last_name) = _name
        AND sl.status = 'approved' AND sl.id IS DISTINCT FROM _exclude_leave
        AND _date BETWEEN sl.start_date AND sl.end_date
        AND (COALESCE(sl.leave_scope,'full_day') <> 'periods' OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE(sl.substitute_plan,'[]'::jsonb)) e
          WHERE (e->>'date') = _date::text AND (e->>'period')::int = _period)))
    AND NOT EXISTS (
      SELECT 1 FROM public.substitute_teaching st
      WHERE st.teaching_date = _date
        AND regexp_replace(st.period, '\D', '', 'g') = _period::text
        AND st.substitute_teacher = _name);
$$;

CREATE OR REPLACE FUNCTION public.pick_auto_substitute_on(_date date, _period integer, _exclude_personnel uuid, _subject_id uuid DEFAULT NULL::uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  WITH t AS (SELECT * FROM public.term_for_date(_date)),
  c AS (
    SELECT p.*, CONCAT(p.prefix, p.first_name, ' ', p.last_name) AS full_name
    FROM public.personnel p
    WHERE p.status = 'active'
      AND p.id <> COALESCE(_exclude_personnel, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  SELECT c.full_name FROM c, t
  WHERE EXISTS (SELECT 1 FROM public.schedules s WHERE s.teacher_name = c.full_name
                  AND s.academic_year = t.year_ce AND s.semester = t.semester)
    AND public.substitute_is_free(c.full_name, _date, _period)
  ORDER BY
    CASE WHEN _subject_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.schedules s2 WHERE s2.subject_id = _subject_id
        AND s2.academic_year = t.year_ce AND s2.semester = t.semester
        AND s2.teacher_name = c.full_name) THEN 0 ELSE 1 END,
    (SELECT count(*) FROM public.schedules s3 WHERE s3.teacher_name = c.full_name
        AND s3.academic_year = t.year_ce AND s3.semester = t.semester
        AND s3.day_of_week = (EXTRACT(DOW FROM _date)::int + 6) % 7 + 1)
    + (SELECT count(*) FROM public.substitute_teaching st WHERE st.substitute_teacher = c.full_name
        AND st.teaching_date = _date),
    (SELECT count(*) FROM public.substitute_teaching st
      WHERE st.substitute_teacher = c.full_name AND st.teaching_date >= _date - 30),
    c.first_name
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.auto_create_substitute_on_leave_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  d date; tname text; sched RECORD; dow int; chosen text; ty int; ts int; by_period boolean; note text;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status <> 'approved') THEN
    SELECT CONCAT(prefix, first_name, ' ', last_name) INTO tname FROM public.personnel WHERE id = NEW.personnel_id;
    by_period := COALESCE(NEW.leave_scope, 'full_day') = 'periods';
    d := NEW.start_date;
    WHILE d <= NEW.end_date LOOP
      dow := (EXTRACT(DOW FROM d)::int + 6) % 7 + 1;
      SELECT year_ce, semester INTO ty, ts FROM public.term_for_date(d);
      IF ty IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.academic_events ae WHERE ae.event_type = 'holiday'
          AND d BETWEEN ae.event_date AND COALESCE(ae.end_date, ae.event_date)) THEN
        FOR sched IN
          SELECT s.subject_id, s.classroom_id, s.period FROM public.schedules s
          WHERE s.teacher_name = tname AND s.day_of_week = dow
            AND s.academic_year = ty AND s.semester = ts
            AND (NOT by_period OR EXISTS (
              SELECT 1 FROM jsonb_array_elements(COALESCE(NEW.substitute_plan,'[]'::jsonb)) e
              WHERE (e->>'date') = d::text AND (e->>'period')::int = s.period))
          ORDER BY s.period
        LOOP
          note := 'สร้างอัตโนมัติจากคำลา ' || NEW.leave_type;
          SELECT NULLIF(TRIM(e->>'teacher'), '') INTO chosen
          FROM jsonb_array_elements(COALESCE(NEW.substitute_plan, '[]'::jsonb)) e
          WHERE (e->>'date') = d::text AND (e->>'period')::int = sched.period LIMIT 1;
          IF chosen IS NULL AND COALESCE(NEW.acting_teacher, '') NOT IN ('', 'none') THEN
            chosen := NEW.acting_teacher;
          END IF;
          IF chosen IS NOT NULL AND (chosen = tname OR NOT public.substitute_is_free(chosen, d, sched.period, NEW.id)) THEN
            note := note || ' • ' || chosen || ' ไม่ว่างคาบนี้ ระบบจัดครูว่างแทน';
            chosen := NULL;
          END IF;
          IF chosen IS NULL THEN
            chosen := public.pick_auto_substitute_on(d, sched.period, NEW.personnel_id, sched.subject_id);
            IF chosen IS NULL THEN note := note || ' • ไม่มีครูว่าง รอจัดเอง'; END IF;
          END IF;
          INSERT INTO public.substitute_teaching
            (original_teacher, substitute_teacher, subject_id, classroom_id, teaching_date, period, status, notes, leave_id)
          VALUES (tname, chosen, sched.subject_id, sched.classroom_id, d, sched.period::text,
            CASE WHEN chosen IS NULL THEN 'pending' ELSE 'confirmed' END, note, NEW.id)
          ON CONFLICT (original_teacher, teaching_date, period) DO UPDATE
            SET substitute_teacher = COALESCE(EXCLUDED.substitute_teacher, public.substitute_teaching.substitute_teacher),
                status = CASE WHEN EXCLUDED.substitute_teacher IS NOT NULL THEN 'confirmed' ELSE public.substitute_teaching.status END,
                notes = EXCLUDED.notes,
                leave_id = EXCLUDED.leave_id;
          chosen := NULL;
        END LOOP;
      END IF;
      d := d + 1;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;