ALTER TABLE public.attendance ADD COLUMN period integer NOT NULL DEFAULT 0;
COMMENT ON COLUMN public.attendance.period IS '0 = school daily attendance or legacy subject record without a known period; positive = explicit lesson period. Never infer lesson presence from gate scans.';
ALTER TABLE public.attendance ADD CONSTRAINT attendance_period_scope CHECK (period >= 0 AND (subject_id IS NOT NULL OR period = 0));
DROP INDEX public.uniq_attendance_per_day_subject;
ALTER TABLE public.attendance DROP CONSTRAINT attendance_student_date_subject_key;
CREATE UNIQUE INDEX uniq_attendance_per_day_subject ON public.attendance (student_id,attendance_date,COALESCE(subject_id,'00000000-0000-0000-0000-000000000000'::uuid),period);
ALTER TABLE public.attendance ADD CONSTRAINT attendance_student_date_subject_key UNIQUE (student_id,attendance_date,subject_id,period);
DO $migration$
DECLARE definition text; fn text;
BEGIN
  definition := pg_get_functiondef('public.auto_attendance_on_face_scan()'::regprocedure);
  definition := replace(definition, 'COALESCE(subject_id,''00000000-0000-0000-0000-000000000000''::uuid))', 'COALESCE(subject_id,''00000000-0000-0000-0000-000000000000''::uuid),period)');
  EXECUTE definition;
  FOREACH fn IN ARRAY ARRAY['notify_parent_on_absence','gchat_on_absence','auto_set_late_minutes'] LOOP
    definition := pg_get_functiondef(( 'public.' || fn || '()')::regprocedure);
    definition := regexp_replace(definition, 'BEGIN', 'BEGIN IF NEW.subject_id IS NOT NULL THEN RETURN NEW; END IF;');
    EXECUTE definition;
  END LOOP;
END $migration$;