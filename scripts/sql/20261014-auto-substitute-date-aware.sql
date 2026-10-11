-- 20261014 — จัดครูสอนแทนอัตโนมัติให้ดู "วันที่สอนแทนจริง"
-- แก้ 2 ข้อ: (1) เช็คการลาตามวันที่สอนแทน ไม่ใช่วันที่กดอนุมัติ
--            (2) ไม่เลือกครูที่ถูกจัดสอนแทนคาบเดียวกันในวันเดียวกันไปแล้ว
-- ไม่แก้/ลบข้อมูลเดิม ฟังก์ชันเดิม pick_auto_substitute ยังอยู่ครบ

CREATE OR REPLACE FUNCTION public.pick_auto_substitute_on(
  _date date, _period integer, _exclude_personnel uuid, _subject_id uuid DEFAULT NULL::uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH c AS (
    SELECT p.id, p.first_name, CONCAT(p.prefix, p.first_name, ' ', p.last_name) AS full_name
    FROM public.personnel p
    WHERE p.status = 'active'
      AND p.id <> COALESCE(_exclude_personnel, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  SELECT c.full_name FROM c
  WHERE NOT EXISTS (
      SELECT 1 FROM public.schedules s
      WHERE s.day_of_week = (EXTRACT(DOW FROM _date)::int + 6) % 7 + 1
        AND s.period = _period AND s.teacher_name = c.full_name)
    AND NOT EXISTS (
      SELECT 1 FROM public.staff_leaves sl
      WHERE sl.personnel_id = c.id AND sl.status = 'approved'
        AND _date BETWEEN sl.start_date AND sl.end_date)
    AND NOT EXISTS (
      SELECT 1 FROM public.substitute_teaching st
      WHERE st.substitute_teacher = c.full_name
        AND st.teaching_date = _date
        AND st.period = 'คาบ ' || _period)
  ORDER BY
    CASE WHEN _subject_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.schedules s2
      WHERE s2.subject_id = _subject_id AND s2.teacher_name = c.full_name) THEN 0 ELSE 1 END,
    (SELECT count(*) FROM public.substitute_teaching st
      WHERE st.substitute_teacher = c.full_name AND st.teaching_date >= _date - 30),
    c.first_name
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.auto_create_substitute_on_leave_approval()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
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
          chosen := NULL; in_plan := NULL; CONTINUE;
        END IF;
        IF chosen IS NULL AND COALESCE(NEW.acting_teacher, '') NOT IN ('', 'none') THEN
          chosen := NEW.acting_teacher;
        END IF;
        IF chosen IS NULL THEN
          chosen := public.pick_auto_substitute_on(d, sched.period, NEW.personnel_id, sched.subject_id);
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

GRANT EXECUTE ON FUNCTION public.pick_auto_substitute_on(date, integer, uuid, uuid) TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
