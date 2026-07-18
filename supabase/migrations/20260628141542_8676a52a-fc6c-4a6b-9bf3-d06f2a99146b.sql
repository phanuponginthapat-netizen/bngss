-- 1) Maintenance function (no auth check, runs via cron)
CREATE OR REPLACE FUNCTION public.auto_period_maintenance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today date := current_date;
  cur_record record;
  target_record record;
  result jsonb := '{}'::jsonb;
  next_year_be int;
BEGIN
  -- Step 1: Auto-switch is_current to the period matching today's date
  SELECT * INTO target_record
  FROM public.academic_periods
  WHERE today BETWEEN start_date AND end_date
  ORDER BY academic_year_be DESC, semester DESC
  LIMIT 1;

  IF target_record.id IS NOT NULL THEN
    -- Only update if not already current
    IF NOT target_record.is_current THEN
      UPDATE public.academic_periods SET is_current = false WHERE is_current = true;
      UPDATE public.academic_periods SET is_current = true WHERE id = target_record.id;
      result := result || jsonb_build_object('switched_to',
        target_record.academic_year_be || '/' || target_record.semester);
    END IF;
  END IF;

  -- Step 2: If current period ends within 30 days and next year doesn't exist, create it
  SELECT * INTO cur_record
  FROM public.academic_periods
  WHERE is_current = true
  ORDER BY semester DESC
  LIMIT 1;

  IF cur_record.id IS NOT NULL AND cur_record.semester = 2 
     AND today >= (cur_record.end_date - interval '30 days')::date THEN
    next_year_be := cur_record.academic_year_be + 1;
    
    IF NOT EXISTS (
      SELECT 1 FROM public.academic_periods WHERE academic_year_be = next_year_be
    ) THEN
      INSERT INTO public.academic_periods
        (academic_year_be, semester, start_date, end_date, is_current, is_closed)
      VALUES
        (next_year_be, 1, 
         make_date(next_year_be - 543, 5, 16),
         make_date(next_year_be - 543, 10, 10),
         false, false),
        (next_year_be, 2,
         make_date(next_year_be - 543, 11, 1),
         make_date(next_year_be - 542, 3, 31),
         false, false);
      result := result || jsonb_build_object('created_year_be', next_year_be);
    END IF;
  END IF;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_period_maintenance() TO service_role, authenticated;

-- 2) Enable pg_cron + schedule daily at 00:05 (Asia/Bangkok ≈ UTC 17:05 previous day)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove old job if exists
DO $$
BEGIN
  PERFORM cron.unschedule('auto-period-maintenance-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'auto-period-maintenance-daily',
  '5 17 * * *',  -- 17:05 UTC = 00:05 Asia/Bangkok
  $$ SELECT public.auto_period_maintenance(); $$
);