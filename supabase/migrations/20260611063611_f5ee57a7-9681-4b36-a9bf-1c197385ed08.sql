ALTER TABLE public.task_assignments DROP CONSTRAINT IF EXISTS task_assignments_subject_id_fkey;
ALTER TABLE public.task_assignments
  ADD CONSTRAINT task_assignments_subject_id_fkey
  FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE SET NULL;

ALTER TABLE public.task_assignments DROP CONSTRAINT IF EXISTS task_assignments_classroom_id_fkey;
ALTER TABLE public.task_assignments
  ADD CONSTRAINT task_assignments_classroom_id_fkey
  FOREIGN KEY (classroom_id) REFERENCES public.classrooms(id) ON DELETE SET NULL;

ALTER TABLE public.task_assignments DROP CONSTRAINT IF EXISTS task_assignments_assigned_to_student_id_fkey;
ALTER TABLE public.task_assignments
  ADD CONSTRAINT task_assignments_assigned_to_student_id_fkey
  FOREIGN KEY (assigned_to_student_id) REFERENCES public.students(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_task_assignments_subject ON public.task_assignments(subject_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_classroom ON public.task_assignments(classroom_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_student ON public.task_assignments(assigned_to_student_id);
