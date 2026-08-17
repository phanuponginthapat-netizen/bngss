DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS inclusion_classroom_id uuid REFERENCES public.classrooms(id) ON DELETE SET NULL';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $idxguard$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS students_inclusion_classroom_id_idx
  ON public.students (inclusion_classroom_id)';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
