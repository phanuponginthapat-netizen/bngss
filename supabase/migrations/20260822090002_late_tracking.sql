-- Add late_minutes column to attendance if not exists
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS late_minutes integer;

-- Function to calculate late minutes from schedule
CREATE OR REPLACE FUNCTION public.calculate_late_minutes(
  _student_id uuid,
  _attendance_date date,
  _scan_time timestamptz
) RETURNS integer AS $$
DECLARE
  _period_start timestamptz;
  _late_min integer;
BEGIN
  -- Find the first scheduled period for this student on this date
  SELECT ts.start_time INTO _period_start
  FROM public.teaching_schedules ts
  JOIN public.students s ON s.classroom_id = ts.classroom_id
  WHERE s.id = _student_id
    AND ts.day_of_week = EXTRACT(DOW FROM _attendance_date)::integer
    AND ts.is_active = true
  ORDER BY ts.start_time
  LIMIT 1;

  IF _period_start IS NULL OR _scan_time IS NULL THEN
    RETURN NULL;
  END IF;

  -- Calculate difference in minutes
  _late_min := EXTRACT(EPOCH FROM (_scan_time - _period_start)) / 60;

  -- Only return if positive (late) and within reasonable range (< 180 min)
  IF _late_min > 0 AND _late_min < 180 THEN
    RETURN _late_min;
  END IF;

  RETURN 0;
END;
$$ LANGUAGE plpgsql STABLE;

-- Auto-update late_minutes on attendance insert/update
CREATE OR REPLACE FUNCTION public.auto_set_late_minutes()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'late' AND NEW.late_minutes IS NULL THEN
    NEW.late_minutes := public.calculate_late_minutes(
      NEW.student_id,
      NEW.attendance_date,
      NEW.scan_time
    );
  END IF;
  IF NEW.status != 'late' THEN
    NEW.late_minutes := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_late_minutes ON public.attendance;
CREATE TRIGGER trg_auto_late_minutes
  BEFORE INSERT OR UPDATE ON public.attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_set_late_minutes();
