DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'ALTER TABLE public.staff_leaves ADD COLUMN IF NOT EXISTS substitute_plan jsonb NOT NULL DEFAULT ''[]''::jsonb';
    EXIT;
    EXCEPTION
      WHEN deadlock_detected OR lock_not_available THEN
        _ddl_try := _ddl_try + 1;
        IF _ddl_try >= 10 THEN
          RAISE NOTICE 'giving up after lock contention: %', SQLERRM;
          EXIT;
        END IF;
        PERFORM pg_sleep(0.4 * _ddl_try);
      WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
        RAISE NOTICE 'skipped: %', SQLERRM;
        EXIT;
    END;
  END LOOP;
END
$guard$;
DO $idxguard$
BEGIN
  EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS uniq_substitute_teaching_slot
  ON public.substitute_teaching (original_teacher, teaching_date, period)';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
DROP FUNCTION IF EXISTS public.pick_auto_substitute(int, int, uuid, uuid) CASCADE;
CREATE OR REPLACE FUNCTION public.pick_auto_substitute(
  _dow int, _period int, _exclude_personnel uuid, _subject_id uuid DEFAULT NULL
) RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CONCAT(p.prefix, p.first_name, ' ', p.last_name)
  FROM public.personnel p
  WHERE p.status = 'active'
    AND p.id <> COALESCE(_exclude_personnel, '00000000-0000-0000-0000-000000000000'::uuid)
    AND NOT EXISTS (
      SELECT 1 FROM public.schedules s
      WHERE s.day_of_week = _dow
        AND s.period = _period
        AND s.teacher_name = CONCAT(p.prefix, p.first_name, ' ', p.last_name)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.staff_leaves sl
      WHERE sl.personnel_id = p.id
        AND sl.status = 'approved'
        AND CURRENT_DATE BETWEEN sl.start_date AND sl.end_date
    )
  ORDER BY
    CASE WHEN _subject_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.schedules s2
      WHERE s2.subject_id = _subject_id
        AND s2.teacher_name = CONCAT(p.prefix, p.first_name, ' ', p.last_name)
    ) THEN 0 ELSE 1 END,
    (SELECT count(*) FROM public.substitute_teaching st
      WHERE st.substitute_teacher = CONCAT(p.prefix, p.first_name, ' ', p.last_name)
        AND st.teaching_date >= CURRENT_DATE - 30),
    p.first_name
  LIMIT 1;
$$;
DROP FUNCTION IF EXISTS public.auto_create_substitute_on_leave_approval() CASCADE;
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
  dow int;
  chosen text;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status <> 'approved') THEN
    SELECT CONCAT(prefix, first_name, ' ', last_name) INTO teacher_name
      FROM public.personnel WHERE id = NEW.personnel_id;

    d := NEW.start_date;
    WHILE d <= NEW.end_date LOOP
      dow := (EXTRACT(DOW FROM d)::int + 6) % 7 + 1;
      FOR sched IN
        SELECT s.id, s.subject_id, s.classroom_id, s.period
        FROM public.schedules s
        WHERE s.teacher_name = teacher_name
          AND s.day_of_week = dow
        ORDER BY s.period
      LOOP
        -- 1) teacher's own per-period choice
        SELECT NULLIF(TRIM(e->>'teacher'), '') INTO chosen
        FROM jsonb_array_elements(COALESCE(NEW.substitute_plan, '[]'::jsonb)) e
        WHERE (e->>'date') = d::text AND (e->>'period')::int = sched.period
        LIMIT 1;

        -- 2) single acting teacher on the leave form
        IF chosen IS NULL AND COALESCE(NEW.acting_teacher, '') NOT IN ('', 'none') THEN
          chosen := NEW.acting_teacher;
        END IF;

        -- 3) automatic assignment
        IF chosen IS NULL THEN
          chosen := public.pick_auto_substitute(dow, sched.period, NEW.personnel_id, sched.subject_id);
        END IF;

        INSERT INTO public.substitute_teaching
          (original_teacher, substitute_teacher, subject_id, classroom_id, teaching_date, period, status, notes, leave_id)
        VALUES
          (teacher_name, chosen, sched.subject_id, sched.classroom_id, d,
           'คาบ ' || sched.period,
           CASE WHEN chosen IS NULL THEN 'pending' ELSE 'confirmed' END,
           'สร้างอัตโนมัติจากคำลา ' || NEW.leave_type, NEW.id)
        ON CONFLICT (original_teacher, teaching_date, period) DO UPDATE
          SET substitute_teacher = COALESCE(EXCLUDED.substitute_teacher, public.substitute_teaching.substitute_teacher),
              status = CASE WHEN EXCLUDED.substitute_teacher IS NOT NULL THEN 'confirmed' ELSE public.substitute_teaching.status END,
              leave_id = EXCLUDED.leave_id;
        chosen := NULL;
      END LOOP;
      d := d + 1;
    END LOOP;
  END IF;
  RETURN NEW;
END $function$;
