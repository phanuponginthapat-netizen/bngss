DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.substitute_teaching
  ADD COLUMN IF NOT EXISTS leave_id uuid';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.substitute_teaching
  DROP CONSTRAINT IF EXISTS substitute_teaching_leave_id_fkey';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.substitute_teaching
  ADD CONSTRAINT substitute_teaching_leave_id_fkey
  FOREIGN KEY (leave_id) REFERENCES public.staff_leaves(id) ON DELETE CASCADE';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $idxguard$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS substitute_teaching_leave_id_idx
  ON public.substitute_teaching(leave_id)';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
