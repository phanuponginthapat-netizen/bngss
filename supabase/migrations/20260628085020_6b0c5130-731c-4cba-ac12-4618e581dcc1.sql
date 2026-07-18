ALTER TABLE public.task_assignments
  ADD COLUMN IF NOT EXISTS worksheet_id uuid REFERENCES public.worksheets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS task_assignments_worksheet_id_idx
  ON public.task_assignments(worksheet_id);