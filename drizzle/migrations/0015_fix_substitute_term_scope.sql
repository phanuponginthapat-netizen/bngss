CREATE OR REPLACE FUNCTION public.term_for_date(_d date)
RETURNS TABLE(year_ce int, semester int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT x.y, x.s FROM (
    SELECT (ap.academic_year_be - 543)::int y, ap.semester::int s, 0 o
      FROM public.academic_periods ap WHERE _d BETWEEN ap.start_date AND ap.end_date
    UNION ALL
    SELECT (ap.academic_year_be - 543)::int, ap.semester::int, 1
      FROM public.academic_periods ap WHERE ap.is_current
  ) x ORDER BY x.o LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.pick_auto_substitute_on(
  _date date, _period int, _exclude_personnel uuid, _subject_id uuid DEFAULT NULL
) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH t AS (SELECT * FROM public.term_for_date(_date))
  SELECT CONCAT(p.prefix, p.first_name, ' ', p.last_name)
  FROM public.personnel p
  WHERE p.status = 'active'
    AND p.id <> COALESCE(_exclude_personnel, '00000000-0000-0000-0000-000000000000'::uuid)
    AND NOT EXISTS (
      SELECT 1 FROM public.schedules s, t
      WHERE s.day_of_week = (EXTRACT(DOW FROM _date)::int + 6) % 7 + 1
        AND s.period = _period AND s.academic_year = t.year_ce AND s.semester = t.semester
        AND s.teacher_name = CONCAT(p.prefix, p.first_name, ' ', p.last_name))
    AND NOT EXISTS (
      SELECT 1 FROM public.staff_leaves sl
      WHERE sl.personnel_id = p.id AND sl.status = 'approved'
        AND _date BETWEEN sl.start_date AND sl.end_date)
    AND NOT EXISTS (
      SELECT 1 FROM public.substitute_teaching st
      WHERE st.teaching_date = _date
        AND regexp_replace(st.period, '\D', '', 'g') = _period::text
        AND st.substitute_teacher = CONCAT(p.prefix, p.first_name, ' ', p.last_name))
  ORDER BY
    CASE WHEN _subject_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.schedules s2, t WHERE s2.subject_id = _subject_id
        AND s2.academic_year = t.year_ce AND s2.semester = t.semester
        AND s2.teacher_name = CONCAT(p.prefix, p.first_name, ' ', p.last_name)) THEN 0 ELSE 1 END,
    (SELECT count(*) FROM public.substitute_teaching st
      WHERE st.substitute_teacher = CONCAT(p.prefix, p.first_name, ' ', p.last_name)
        AND st.teaching_date >= _date - 30),
    p.first_name
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.pick_auto_substitute_on(date,int,uuid,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.term_for_date(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.term_for_date(date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.auto_create_substitute_on_leave_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  d date; tname text; sched RECORD; dow int; chosen text; ty int; ts int; by_period boolean;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status <> 'approved') THEN
    SELECT CONCAT(prefix, first_name, ' ', last_name) INTO tname FROM public.personnel WHERE id = NEW.personnel_id;
    by_period := COALESCE(NEW.leave_scope, 'full_day') = 'periods';
    d := NEW.start_date;
    WHILE d <= NEW.end_date LOOP
      dow := (EXTRACT(DOW FROM d)::int + 6) % 7 + 1;
      SELECT year_ce, semester INTO ty, ts FROM public.term_for_date(d);
      IF ty IS NOT NULL THEN
        FOR sched IN
          SELECT s.subject_id, s.classroom_id, s.period FROM public.schedules s
          WHERE s.teacher_name = tname AND s.day_of_week = dow
            AND s.academic_year = ty AND s.semester = ts
            AND (NOT by_period OR EXISTS (
              SELECT 1 FROM jsonb_array_elements(COALESCE(NEW.substitute_plan,'[]'::jsonb)) e
              WHERE (e->>'date') = d::text AND (e->>'period')::int = s.period))
          ORDER BY s.period
        LOOP
          SELECT NULLIF(TRIM(e->>'teacher'), '') INTO chosen
          FROM jsonb_array_elements(COALESCE(NEW.substitute_plan, '[]'::jsonb)) e
          WHERE (e->>'date') = d::text AND (e->>'period')::int = sched.period LIMIT 1;
          IF chosen IS NULL AND COALESCE(NEW.acting_teacher, '') NOT IN ('', 'none') THEN
            chosen := NEW.acting_teacher;
          END IF;
          IF chosen IS NULL THEN
            chosen := public.pick_auto_substitute_on(d, sched.period, NEW.personnel_id, sched.subject_id);
          END IF;
          INSERT INTO public.substitute_teaching
            (original_teacher, substitute_teacher, subject_id, classroom_id, teaching_date, period, status, notes, leave_id)
          VALUES (tname, chosen, sched.subject_id, sched.classroom_id, d, sched.period::text,
            CASE WHEN chosen IS NULL THEN 'pending' ELSE 'confirmed' END,
            'สร้างอัตโนมัติจากคำลา ' || NEW.leave_type, NEW.id)
          ON CONFLICT (original_teacher, teaching_date, period) DO UPDATE
            SET substitute_teacher = COALESCE(EXCLUDED.substitute_teacher, public.substitute_teaching.substitute_teacher),
                status = CASE WHEN EXCLUDED.substitute_teacher IS NOT NULL THEN 'confirmed' ELSE public.substitute_teaching.status END,
                leave_id = EXCLUDED.leave_id;
          chosen := NULL;
        END LOOP;
      END IF;
      d := d + 1;
    END LOOP;
  END IF;
  RETURN NEW;
END $function$;

UPDATE public.substitute_teaching st
SET period = regexp_replace(st.period, '\D', '', 'g')
WHERE st.period ~ '\D' AND regexp_replace(st.period, '\D', '', 'g') <> ''
  AND NOT EXISTS (SELECT 1 FROM public.substitute_teaching o
    WHERE o.original_teacher = st.original_teacher AND o.teaching_date = st.teaching_date
      AND o.period = regexp_replace(st.period, '\D', '', 'g'));