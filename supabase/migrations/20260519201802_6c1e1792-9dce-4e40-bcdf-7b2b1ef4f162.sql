-- Dedupe subjects table: keep the earliest row per (school_id, name_th, grade_level, semester, academic_year)
-- and re-point all FKs to the canonical id, then delete duplicates.

DO $$
DECLARE
  dup RECORD;
  keep_id uuid;
  dup_ids uuid[];
BEGIN
  FOR dup IN
    SELECT
      school_id, name_th, grade_level, semester, academic_year,
      (array_agg(id ORDER BY created_at ASC, id ASC))[1] AS keep_id,
      array_agg(id ORDER BY created_at ASC, id ASC) AS all_ids
    FROM public.subjects
    GROUP BY school_id, name_th, grade_level, semester, academic_year
    HAVING COUNT(*) > 1
  LOOP
    keep_id := dup.keep_id;
    dup_ids := dup.all_ids[2:array_length(dup.all_ids,1)];

    -- Re-point referencing tables
    UPDATE public.schedules            SET subject_id = keep_id WHERE subject_id = ANY(dup_ids);
    UPDATE public.teacher_assignments  SET subject_id = keep_id WHERE subject_id = ANY(dup_ids);
    UPDATE public.homework_assignments SET subject_id = keep_id WHERE subject_id = ANY(dup_ids);
    UPDATE public.substitute_teaching  SET subject_id = keep_id WHERE subject_id = ANY(dup_ids);
    UPDATE public.task_assignments     SET subject_id = keep_id WHERE subject_id = ANY(dup_ids);
    UPDATE public.subject_score_columns SET subject_id = keep_id WHERE subject_id = ANY(dup_ids);
    UPDATE public.student_scores       SET subject_id = keep_id WHERE subject_id = ANY(dup_ids);
    UPDATE public.attendance           SET subject_id = keep_id WHERE subject_id = ANY(dup_ids);
    UPDATE public.subject_indicators   SET subject_id = keep_id WHERE subject_id = ANY(dup_ids);
    UPDATE public.enrollments          SET subject_id = keep_id WHERE subject_id = ANY(dup_ids);

    -- Delete duplicates
    DELETE FROM public.subjects WHERE id = ANY(dup_ids);
  END LOOP;
END $$;
-- Prevent future duplicates
DO $idxguard$
BEGIN
  EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS subjects_unique_per_school_grade_sem_year
  ON public.subjects (school_id, name_th, grade_level, semester, academic_year)';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
