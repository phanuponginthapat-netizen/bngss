
-- Add offsite columns to time_clock for off-site clock-in
ALTER TABLE public.time_clock
  ADD COLUMN IF NOT EXISTS is_offsite BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS offsite_reason TEXT,
  ADD COLUMN IF NOT EXISTS offsite_location TEXT;

-- Create offsite_requests table for 3 request types:
--   official_duty  = ขออนุญาตไปราชการ
--   offsite_during = ขอออกนอกสถานที่ระหว่างวัน (มีกำหนดกลับ)
--   early_leave    = ขอออกก่อนเวลา (ไม่กลับ)
CREATE TABLE IF NOT EXISTS public.offsite_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id UUID NOT NULL REFERENCES public.personnel(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL DEFAULT 'official_duty',
  request_date DATE NOT NULL DEFAULT CURRENT_DATE,
  leave_time TIME,
  return_date DATE,
  return_time TIME,
  reason TEXT,
  location TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  rejected_reason TEXT,
  acting_teacher TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.offsite_requests TO authenticated;
GRANT ALL ON public.offsite_requests TO service_role;

ALTER TABLE public.offsite_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage own offsite_requests"
  ON public.offsite_requests
  FOR ALL
  TO authenticated
  USING (personnel_id IN (SELECT id FROM public.personnel WHERE user_id = auth.uid()))
  WITH CHECK (personnel_id IN (SELECT id FROM public.personnel WHERE user_id = auth.uid()));

CREATE POLICY "Admin/director manage all offsite_requests"
  ON public.offsite_requests
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role));

CREATE TRIGGER update_offsite_requests_updated_at
  BEFORE UPDATE ON public.offsite_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_offsite_requests_personnel ON public.offsite_requests(personnel_id, request_date DESC);
CREATE INDEX IF NOT EXISTS idx_offsite_requests_status ON public.offsite_requests(status);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.offsite_requests;
