DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'DROP POLICY IF EXISTS "Homework files: owner or same-school members" ON storage.objects';
    EXIT;
    EXCEPTION
      WHEN deadlock_detected OR lock_not_available THEN
        _ddl_try := _ddl_try + 1;
        IF _ddl_try >= 10 THEN
          RAISE NOTICE 'giving up after lock contention: %', SQLERRM;
          EXIT;
        END IF;
        PERFORM pg_sleep(0.4 * _ddl_try);
      WHEN insufficient_privilege OR undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
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
      EXECUTE 'DROP POLICY IF EXISTS "Homework files: owner or same-school members" ON storage.objects';
    EXIT;
    EXCEPTION
      WHEN deadlock_detected OR lock_not_available THEN
        _ddl_try := _ddl_try + 1;
        IF _ddl_try >= 10 THEN
          RAISE NOTICE 'giving up after lock contention: %', SQLERRM;
          EXIT;
        END IF;
        PERFORM pg_sleep(0.4 * _ddl_try);
      WHEN insufficient_privilege OR undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
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
      EXECUTE 'CREATE POLICY "Homework files: owner or same-school members"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
      bucket_id = ''homework-files''
      AND (
        owner = auth.uid()
        OR public.has_role(auth.uid(), ''admin''::public.app_role)
        OR public.has_role(auth.uid(), ''director''::public.app_role)
        OR EXISTS (
          SELECT 1
          FROM public.task_assignments t
          LEFT JOIN public.classrooms c ON c.id = t.classroom_id
          WHERE (
            t.assigned_by = auth.uid()
            OR t.assigned_to_user_id = auth.uid()
            OR (c.school_id IS NOT NULL AND c.school_id = public.get_user_school_id(auth.uid()))
          )
        )
        OR EXISTS (
          SELECT 1
          FROM public.homework_assignments h
          LEFT JOIN public.classrooms c ON c.id = h.classroom_id
          LEFT JOIN public.students s ON s.classroom_id = h.classroom_id AND s.auth_user_id = auth.uid()
          WHERE (
            h.created_by = auth.uid()
            OR s.id IS NOT NULL
            OR (c.school_id IS NOT NULL AND c.school_id = public.get_user_school_id(auth.uid()))
          )
        )
      )
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
      WHEN insufficient_privilege OR undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
        RAISE NOTICE 'skipped: %', SQLERRM;
        EXIT;
    END;
  END LOOP;
END
$guard$;
