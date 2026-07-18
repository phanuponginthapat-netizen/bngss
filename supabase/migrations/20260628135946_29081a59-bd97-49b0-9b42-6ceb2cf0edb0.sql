ALTER TABLE public.students 
  ADD COLUMN IF NOT EXISTS transition_pending_to TEXT,
  ADD COLUMN IF NOT EXISTS transition_pending_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_students_transition_pending 
  ON public.students(transition_pending_to) 
  WHERE transition_pending_to IS NOT NULL;

COMMENT ON COLUMN public.students.transition_pending_to IS 'ระดับชั้นรอยต่อที่รอ admin จัดห้อง (ป.1/ม.1/ม.4) — NULL = ไม่อยู่ใน holding zone';
COMMENT ON COLUMN public.students.transition_pending_at IS 'เวลาที่ถูกย้ายเข้า holding zone';