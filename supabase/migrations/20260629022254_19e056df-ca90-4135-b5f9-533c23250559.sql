ALTER TABLE public.ict_loans
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS period_no integer,
  ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subject_name text,
  ADD COLUMN IF NOT EXISTS teaching_topic text,
  ADD COLUMN IF NOT EXISTS session_date date,
  ADD COLUMN IF NOT EXISTS batch_id uuid;

CREATE INDEX IF NOT EXISTS idx_ict_loans_batch_id ON public.ict_loans(batch_id);
CREATE INDEX IF NOT EXISTS idx_ict_loans_session_date ON public.ict_loans(session_date);
CREATE INDEX IF NOT EXISTS idx_ict_loans_status ON public.ict_loans(status);