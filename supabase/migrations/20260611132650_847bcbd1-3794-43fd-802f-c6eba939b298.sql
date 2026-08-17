-- Helper: ครูคนนี้เป็นครูประจำชั้นของนักเรียนคนนี้หรือไม่ (จับชื่อแบบหลวม ๆ ตามที่ UI ใช้)
DROP FUNCTION IF EXISTS public.is_homeroom_teacher_of_student(uuid, uuid) CASCADE;
CREATE OR REPLACE FUNCTION public.is_homeroom_teacher_of_student(_user_id uuid, _student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH p AS (
    SELECT first_name, last_name
    FROM public.personnel
    WHERE user_id = _user_id
    LIMIT 1
  ),
  s AS (
    SELECT classroom_id
    FROM public.students
    WHERE id = _student_id
  ),
  norm AS (
    SELECT
      regexp_replace(
        regexp_replace(coalesce(c.homeroom_teacher,''),
          '^(ครู|นางสาว|นาง|นาย|ด\.ช\.|ด\.ญ\.|เด็กชาย|เด็กหญิง)', '', 'g'),
        '\s+', '', 'g') AS a,
      regexp_replace(
        regexp_replace(coalesce(c.homeroom_teacher_2,''),
          '^(ครู|นางสาว|นาง|นาย|ด\.ช\.|ด\.ญ\.|เด็กชาย|เด็กหญิง)', '', 'g'),
        '\s+', '', 'g') AS b,
      regexp_replace(
        (SELECT first_name || ' ' || last_name FROM p),
        '\s+', '', 'g') AS cand
    FROM public.classrooms c
    WHERE c.id = (SELECT classroom_id FROM s)
  )
  SELECT EXISTS (
    SELECT 1 FROM norm
    WHERE cand <> '' AND (a = cand OR b = cand)
  );
$$;
-- เปลี่ยน policy ของ student_leaves ให้ครูเห็นเฉพาะนักเรียนในห้องตัวเอง
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'DROP POLICY IF EXISTS "Staff manage student_leaves" ON public.student_leaves';
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
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'DROP POLICY IF EXISTS "school_scope_teacher" ON public.student_leaves';
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
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'DROP POLICY IF EXISTS "Admin director manage student_leaves" ON public.student_leaves';
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
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'DROP POLICY IF EXISTS "Admin director manage student_leaves" ON public.student_leaves';
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
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'CREATE POLICY "Admin director manage student_leaves"
    ON public.student_leaves
    FOR ALL
    TO authenticated
    USING (
      public.has_role(auth.uid(), ''admin''::app_role)
      OR public.has_role(auth.uid(), ''director''::app_role)
    )
    WITH CHECK (
      public.has_role(auth.uid(), ''admin''::app_role)
      OR public.has_role(auth.uid(), ''director''::app_role)
    )';
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
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'DROP POLICY IF EXISTS "Homeroom teacher manage student_leaves" ON public.student_leaves';
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
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'DROP POLICY IF EXISTS "Homeroom teacher manage student_leaves" ON public.student_leaves';
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
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'CREATE POLICY "Homeroom teacher manage student_leaves"
    ON public.student_leaves
    FOR ALL
    TO authenticated
    USING (
      public.has_role(auth.uid(), ''teacher''::app_role)
      AND public.is_homeroom_teacher_of_student(auth.uid(), student_id)
    )
    WITH CHECK (
      public.has_role(auth.uid(), ''teacher''::app_role)
      AND public.is_homeroom_teacher_of_student(auth.uid(), student_id)
    )';
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
