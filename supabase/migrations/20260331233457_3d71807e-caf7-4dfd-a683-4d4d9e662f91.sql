-- Function: auto-enroll students when teacher_assignment is created
CREATE OR REPLACE FUNCTION public.auto_enroll_students_on_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Insert enrollments for all active students in the classroom
  INSERT INTO public.enrollments (student_id, subject_id, classroom_id, academic_year, semester, status, enrollment_type)
  SELECT 
    s.id,
    NEW.subject_id,
    NEW.classroom_id,
    NEW.academic_year,
    NEW.semester,
    'active',
    'auto'
  FROM public.students s
  WHERE s.classroom_id = NEW.classroom_id
    AND s.status = 'active'
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$$;
-- Trigger on teacher_assignments insert
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trigger_auto_enroll_students ON public.teacher_assignments';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trigger_auto_enroll_students
  AFTER INSERT ON public.teacher_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_enroll_students_on_assignment()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- Also add unique constraint on enrollments to support ON CONFLICT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'enrollments_student_subject_year_unique'
  ) THEN
    ALTER TABLE public.enrollments 
      ADD CONSTRAINT enrollments_student_subject_year_unique 
      UNIQUE (student_id, subject_id, academic_year, semester);
  END IF;
END $$;
