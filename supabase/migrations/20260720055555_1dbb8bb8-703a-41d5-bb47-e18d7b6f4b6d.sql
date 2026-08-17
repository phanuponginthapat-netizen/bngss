
CREATE TABLE IF NOT EXISTS public.attendance_auto_holidays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  holiday_date DATE NOT NULL UNIQUE,
  reason TEXT NOT NULL DEFAULT 'auto_detected_high_absence',
  absent_count INTEGER NOT NULL DEFAULT 0,
  total_students INTEGER NOT NULL DEFAULT 0,
  detected_by TEXT NOT NULL DEFAULT 'notify-attendance-digest',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.attendance_auto_holidays TO authenticated;
GRANT ALL ON public.attendance_auto_holidays TO service_role;

ALTER TABLE public.attendance_auto_holidays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated read holidays" ON public.attendance_auto_holidays;
DROP POLICY IF EXISTS "authenticated read holidays" ON public.attendance_auto_holidays;
CREATE POLICY "authenticated read holidays"
  ON public.attendance_auto_holidays FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "admin manage holidays" ON public.attendance_auto_holidays;
DROP POLICY IF EXISTS "admin manage holidays" ON public.attendance_auto_holidays;
CREATE POLICY "admin manage holidays"
  ON public.attendance_auto_holidays FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_attendance_auto_holidays_date ON public.attendance_auto_holidays(holiday_date);

DROP TRIGGER IF EXISTS trg_attendance_auto_holidays_updated ON public.attendance_auto_holidays;
CREATE TRIGGER trg_attendance_auto_holidays_updated
  BEFORE UPDATE ON public.attendance_auto_holidays
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
