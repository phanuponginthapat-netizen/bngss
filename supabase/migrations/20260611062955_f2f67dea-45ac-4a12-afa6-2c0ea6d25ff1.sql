
ALTER TABLE public.substitute_teaching
  ADD COLUMN IF NOT EXISTS leave_id uuid;

ALTER TABLE public.substitute_teaching
  DROP CONSTRAINT IF EXISTS substitute_teaching_leave_id_fkey;

ALTER TABLE public.substitute_teaching
  ADD CONSTRAINT substitute_teaching_leave_id_fkey
  FOREIGN KEY (leave_id) REFERENCES public.staff_leaves(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS substitute_teaching_leave_id_idx
  ON public.substitute_teaching(leave_id);
