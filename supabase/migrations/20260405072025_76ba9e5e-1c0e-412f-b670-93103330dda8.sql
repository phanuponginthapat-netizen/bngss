-- Add unique constraint for upsert on student_scores
ALTER TABLE public.student_scores DROP CONSTRAINT IF EXISTS student_scores_student_code_subject_id_key;
ALTER TABLE public.student_scores 
ADD CONSTRAINT student_scores_student_code_subject_id_key 
UNIQUE (student_code, subject_id);