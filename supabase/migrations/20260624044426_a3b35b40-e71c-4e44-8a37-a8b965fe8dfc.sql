-- 1) Link score columns to homework + add status to student_column_scores
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'ALTER TABLE public.subject_score_columns
      ADD COLUMN IF NOT EXISTS homework_assignment_id uuid REFERENCES public.homework_assignments(id) ON DELETE CASCADE';
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
DO $idxguard$
BEGIN
  EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS uq_subject_score_columns_homework
  ON public.subject_score_columns(homework_assignment_id)
  WHERE homework_assignment_id IS NOT NULL';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'ALTER TABLE public.student_column_scores
      ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT ''manual''';
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
-- status: 'manual' | 'pending' | 'graded' | 'overdue'

-- 2) Auto-create score column + pending student rows when a homework assignment is created
DROP FUNCTION IF EXISTS public.sync_homework_to_pp5() CASCADE;
CREATE OR REPLACE FUNCTION public.sync_homework_to_pp5()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_column_id uuid;
  v_max numeric;
  v_order int;
BEGIN
  IF NEW.subject_id IS NULL OR NEW.classroom_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_max := COALESCE(NEW.total_score, 10);

  IF TG_OP = 'INSERT' THEN
    SELECT COALESCE(MAX(sort_order), 0) + 1 INTO v_order
      FROM public.subject_score_columns WHERE subject_id = NEW.subject_id;

    INSERT INTO public.subject_score_columns (
      subject_id, column_name, column_type, max_score, sort_order, half, homework_assignment_id
    ) VALUES (
      NEW.subject_id,
      COALESCE(NEW.title, 'การบ้าน'),
      'assignment',
      v_max,
      v_order,
      'pre',
      NEW.id
    )
    RETURNING id INTO v_column_id;

    -- Seed pending rows for every active student in the classroom
    INSERT INTO public.student_column_scores (student_id, column_id, score, status)
    SELECT s.id, v_column_id, 0, 'pending'
      FROM public.students s
      WHERE s.classroom_id = NEW.classroom_id AND s.status = 'active'
    ON CONFLICT (student_id, column_id) DO NOTHING;

  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.subject_score_columns
       SET column_name = COALESCE(NEW.title, column_name),
           max_score = COALESCE(NEW.total_score, max_score)
     WHERE homework_assignment_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'DROP TRIGGER IF EXISTS trg_homework_to_pp5 ON public.homework_assignments';
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
      EXECUTE 'CREATE TRIGGER trg_homework_to_pp5
    AFTER INSERT OR UPDATE OF title, total_score, subject_id, classroom_id
    ON public.homework_assignments
    FOR EACH ROW EXECUTE FUNCTION public.sync_homework_to_pp5()';
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
-- 3) When a submission is graded (final_score set) -> update score & mark graded
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
  IF NEW.final_score IS NULL THEN
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
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'DROP TRIGGER IF EXISTS trg_homework_submission_to_pp5 ON public.homework_submissions';
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
      EXECUTE 'CREATE TRIGGER trg_homework_submission_to_pp5
    AFTER INSERT OR UPDATE OF final_score
    ON public.homework_submissions
    FOR EACH ROW EXECUTE FUNCTION public.sync_homework_submission_to_pp5()';
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
-- 4) Mark overdue: pending rows whose homework due_date passed become 'overdue'/score=0
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
       AND ha.due_date < CURRENT_DATE
    RETURNING scs.id
  )
  SELECT COUNT(*) INTO v_count FROM updated;
  RETURN v_count;
END;
$$;
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'REVOKE ALL ON FUNCTION public.mark_overdue_homework_columns() FROM PUBLIC';
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
      EXECUTE 'GRANT EXECUTE ON FUNCTION public.mark_overdue_homework_columns() TO authenticated';
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
-- 5) Backfill existing homework assignments (so historical ones gain columns too)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT ha.* FROM public.homework_assignments ha
    LEFT JOIN public.subject_score_columns col ON col.homework_assignment_id = ha.id
    WHERE col.id IS NULL
      AND ha.subject_id IS NOT NULL
      AND ha.classroom_id IS NOT NULL
  LOOP
    PERFORM public.sync_homework_to_pp5_one(r.id);
  END LOOP;
EXCEPTION WHEN undefined_function THEN
  -- helper not defined; skip backfill safely
  NULL;
END $$;
