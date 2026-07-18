ALTER TABLE public.task_assignments
  ADD COLUMN IF NOT EXISTS max_score numeric;

ALTER TABLE public.padlet_boards
  ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS classroom_id uuid REFERENCES public.classrooms(id) ON DELETE SET NULL;

ALTER TABLE public.padlet_notes
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;
