-- Enable pg_cron and pg_net for scheduled cleanup
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Auto archive function: delete read notifications & inbox_items older than 6 months
CREATE OR REPLACE FUNCTION public.archive_old_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notif_deleted INT := 0;
  inbox_deleted INT := 0;
BEGIN
  WITH d AS (
    DELETE FROM public.notifications
    WHERE created_at < now() - INTERVAL '6 months'
      AND is_read = true
    RETURNING 1
  )
  SELECT count(*) INTO notif_deleted FROM d;

  WITH d AS (
    DELETE FROM public.inbox_items
    WHERE created_at < now() - INTERVAL '6 months'
      AND is_read = true
    RETURNING 1
  )
  SELECT count(*) INTO inbox_deleted FROM d;

  -- Log into school_settings
  INSERT INTO public.school_settings (setting_key, setting_value)
  VALUES ('last_archive_run', jsonb_build_object(
    'ran_at', now(),
    'notifications_deleted', notif_deleted,
    'inbox_deleted', inbox_deleted
  )::text)
  ON CONFLICT (setting_key) DO UPDATE
    SET setting_value = EXCLUDED.setting_value, updated_at = now();

  RETURN jsonb_build_object(
    'notifications_deleted', notif_deleted,
    'inbox_deleted', inbox_deleted
  );
END;
$$;

-- Allow admins to call manually
GRANT EXECUTE ON FUNCTION public.archive_old_data() TO authenticated;

-- Schedule monthly run on 1st day of each month at 02:00 UTC
DO $$
BEGIN
  -- Unschedule existing (idempotent)
  PERFORM cron.unschedule(jobid)
  FROM cron.job WHERE jobname = 'monthly-archive-old-data';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'monthly-archive-old-data',
  '0 2 1 * *',
  $$ SELECT public.archive_old_data(); $$
);

-- Cloud usage estimation function (admin only)
CREATE OR REPLACE FUNCTION public.get_cloud_usage_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  notif_count BIGINT;
  inbox_count BIGINT;
  notif_old BIGINT;
  inbox_old BIGINT;
  student_count BIGINT;
  personnel_count BIGINT;
  attendance_count BIGINT;
BEGIN
  -- Permission check
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT count(*) INTO notif_count FROM public.notifications;
  SELECT count(*) INTO inbox_count FROM public.inbox_items;
  SELECT count(*) INTO notif_old FROM public.notifications WHERE created_at < now() - INTERVAL '6 months' AND is_read = true;
  SELECT count(*) INTO inbox_old FROM public.inbox_items WHERE created_at < now() - INTERVAL '6 months' AND is_read = true;
  SELECT count(*) INTO student_count FROM public.students WHERE status = 'active';
  SELECT count(*) INTO personnel_count FROM public.personnel WHERE status = 'active';
  SELECT count(*) INTO attendance_count FROM public.attendance;

  result := jsonb_build_object(
    'notifications_total', notif_count,
    'notifications_archivable', notif_old,
    'inbox_total', inbox_count,
    'inbox_archivable', inbox_old,
    'students_active', student_count,
    'personnel_active', personnel_count,
    'attendance_total', attendance_count,
    'computed_at', now()
  );
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_cloud_usage_summary() TO authenticated;