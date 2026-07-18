
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS inclusion_classroom_id uuid REFERENCES public.classrooms(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS students_inclusion_classroom_id_idx
  ON public.students (inclusion_classroom_id);
