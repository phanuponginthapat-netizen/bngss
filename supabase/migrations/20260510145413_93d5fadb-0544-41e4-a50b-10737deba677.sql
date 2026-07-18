
ALTER TABLE public.ict_loans ADD COLUMN IF NOT EXISTS overdue_notified_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_ict_loans_active_due ON public.ict_loans (expected_return_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_ict_loans_student ON public.ict_loans (student_id, borrowed_at DESC);
