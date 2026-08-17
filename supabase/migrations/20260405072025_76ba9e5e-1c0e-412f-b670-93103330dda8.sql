-- Add unique constraint for upsert on student_scores
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.student_scores DROP CONSTRAINT IF EXISTS student_scores_student_code_subject_id_key';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.student_scores 
ADD CONSTRAINT student_scores_student_code_subject_id_key 
UNIQUE (student_code, subject_id)';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
