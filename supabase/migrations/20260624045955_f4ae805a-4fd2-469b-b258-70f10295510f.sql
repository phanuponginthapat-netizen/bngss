-- Fix 1: submission trigger should only fire when status = 'graded'
DROP FUNCTION IF EXISTS public.sync_homework_submission_to_pp5() CASCADE;
CREATE OR REPLACE FUNCTION public.sync_homework_submission_to_pp5()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_column_id uuid;
BEGIN
  -- ต้องเป็นงานที่ครูตรวจแล้วเท่านั้น (final_score มีค่า + status = graded)
  IF NEW.final_score IS NULL OR COALESCE(NEW.status, '') <> 'graded' THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_column_id
    FROM public.subject_score_columns
   WHERE homework_assignment_id = NEW.assignment_id
   LIMIT 1;

  IF v_column_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.student_column_scores (student_id, column_id, score, status)
  VALUES (NEW.student_id, v_column_id, NEW.final_score, 'graded')
  ON CONFLICT (student_id, column_id)
  DO UPDATE SET score = EXCLUDED.score, status = 'graded';

  RETURN NEW;
END;
$$;
-- ตั้ง trigger ใหม่ให้ฟังการเปลี่ยน status ด้วย (เผื่อครูกดอนุมัติทีหลัง)
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_homework_submission_to_pp5 ON public.homework_submissions';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_homework_submission_to_pp5
AFTER INSERT OR UPDATE OF final_score, status
ON public.homework_submissions
FOR EACH ROW EXECUTE FUNCTION public.sync_homework_submission_to_pp5()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- Fix 2: due_date = today ยังไม่ใช่ overdue
DROP FUNCTION IF EXISTS public.mark_overdue_homework_columns() CASCADE;
CREATE OR REPLACE FUNCTION public.mark_overdue_homework_columns()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH updated AS (
    UPDATE public.student_column_scores scs
       SET status = 'overdue', score = 0
      FROM public.subject_score_columns col
      JOIN public.homework_assignments ha ON ha.id = col.homework_assignment_id
     WHERE scs.column_id = col.id
       AND scs.status = 'pending'
       AND ha.due_date IS NOT NULL
       AND ha.due_date < (CURRENT_DATE)::date
    RETURNING scs.id
  )
  SELECT COUNT(*) INTO v_count FROM updated;
  RETURN v_count;
END;
$$;
-- Fix 3: backfill ที่ใช้งานได้จริง (migration เดิมเรียก helper ที่ไม่มี → เงียบ)
DO $$
DECLARE
  r record;
  v_column_id uuid;
  v_order int;
  v_max numeric;
BEGIN
  FOR r IN
    SELECT ha.* FROM public.homework_assignments ha
    LEFT JOIN public.subject_score_columns col ON col.homework_assignment_id = ha.id
    WHERE col.id IS NULL
      AND ha.subject_id IS NOT NULL
      AND ha.classroom_id IS NOT NULL
  LOOP
    SELECT COALESCE(MAX(sort_order), 0) + 1 INTO v_order
      FROM public.subject_score_columns WHERE subject_id = r.subject_id;
    v_max := COALESCE(r.total_score, 10);

    INSERT INTO public.subject_score_columns (
      subject_id, column_name, column_type, max_score, sort_order, half, homework_assignment_id
    ) VALUES (
      r.subject_id, COALESCE(r.title, 'การบ้าน'),
      'assignment', v_max, v_order, 'pre', r.id
    )
    RETURNING id INTO v_column_id;

    INSERT INTO public.student_column_scores (student_id, column_id, score, status)
    SELECT s.id, v_column_id, 0, 'pending'
      FROM public.students s
      WHERE s.classroom_id = r.classroom_id AND s.status = 'active'
    ON CONFLICT (student_id, column_id) DO NOTHING;
  END LOOP;
END $$;
-- Fix 4: ถ้ามี submission ที่ graded อยู่แล้ว → sync เข้า ปพ.5
UPDATE public.student_column_scores scs
   SET score = sub.final_score, status = 'graded'
  FROM public.homework_submissions sub
  JOIN public.subject_score_columns col ON col.homework_assignment_id = sub.assignment_id
 WHERE scs.column_id = col.id
   AND scs.student_id = sub.student_id
   AND sub.final_score IS NOT NULL
   AND sub.status = 'graded';
