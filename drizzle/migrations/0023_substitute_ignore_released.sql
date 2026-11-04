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
        AND sl.status = 'approved' AND sl.revoked_at IS NULL AND sl.id IS DISTINCT FROM _exclude_leave
        AND _date BETWEEN sl.start_date AND sl.end_date
        AND (COALESCE(sl.leave_scope,'full_day') <> 'periods' OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE(sl.substitute_plan,'[]'::jsonb)) e
          WHERE (e->>'date') = _date::text AND (e->>'period')::int = _period)))
    AND NOT EXISTS (
      SELECT 1 FROM public.substitute_teaching st
      WHERE st.teaching_date = _date
        AND regexp_replace(st.period, '\D', '', 'g') = _period::text
        AND st.substitute_teacher = _name
        AND st.status NOT IN ('released','no_substitute'));
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
        AND st.teaching_date = _date AND st.status NOT IN ('released','no_substitute')),
    (SELECT count(*) FROM public.substitute_teaching st
      WHERE st.substitute_teacher = c.full_name AND st.teaching_date >= _date - 30
        AND st.status NOT IN ('released','no_substitute')),
    c.first_name
  LIMIT 1;
$function$;