-- Holiday system: make calendar holidays affect entire system (scan, PP5, attendance)
-- academic_events with event_type='holiday' defines holidays (single day or range via end_date)

-- Helper function: is_holiday(date) checks both academic_events and attendance_auto_holidays
CREATE OR REPLACE FUNCTION public.is_holiday(check_date date)
RETURNS boolean AS $$
BEGIN
  -- Check academic_events holidays (event_type = 'holiday')
  IF EXISTS (
    SELECT 1 FROM public.academic_events
    WHERE event_type = 'holiday'
      AND check_date >= event_date
      AND check_date <= COALESCE(end_date, event_date)
  ) THEN
    RETURN true;
  END IF;
  -- Check auto-detected holidays
  IF EXISTS (
    SELECT 1 FROM public.attendance_auto_holidays
    WHERE holiday_date = check_date
  ) THEN
    RETURN true;
  END IF;
  RETURN false;
END;
$$ LANGUAGE plpgsql STABLE;

-- View for holidays list
CREATE OR REPLACE VIEW public.holidays AS
SELECT event_date as holiday_date, COALESCE(end_date, event_date) as end_date, title as reason, 'calendar' as source
FROM public.academic_events WHERE event_type = 'holiday'
UNION ALL
SELECT holiday_date, holiday_date as end_date, reason, 'auto' as source
FROM public.attendance_auto_holidays;

GRANT SELECT ON public.holidays TO authenticated;

-- Function to get attendance rate excluding holidays
CREATE OR REPLACE FUNCTION public.attendance_rate_excluding_holidays(p_student_id uuid, p_start date, p_end date)
RETURNS numeric AS $$
DECLARE
  total_days integer;
  present_days integer;
BEGIN
  SELECT COUNT(*) INTO total_days
  FROM generate_series(p_start, p_end, '1 day'::interval) d
  WHERE EXTRACT(DOW FROM d) NOT IN (0,6) -- exclude weekends
    AND NOT public.is_holiday(d::date);

  SELECT COUNT(DISTINCT scan_date) INTO present_days
  FROM public.face_scan_logs
  WHERE student_id = p_student_id
    AND scan_date BETWEEN p_start AND p_end
    AND scan_type = 'entry';

  IF total_days = 0 THEN RETURN 100; END IF;
  RETURN ROUND((present_days::numeric / total_days * 100), 1);
END;
$$ LANGUAGE plpgsql STABLE;
