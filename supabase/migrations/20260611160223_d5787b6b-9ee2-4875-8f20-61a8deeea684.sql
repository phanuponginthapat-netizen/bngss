
CREATE OR REPLACE FUNCTION public.archive_old_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  notif_deleted INT := 0;
  inbox_deleted INT := 0;
  cur_month INT := EXTRACT(month FROM now())::int;
  cur_year INT := EXTRACT(year FROM now())::int;
  current_academic_year INT;
  cutoff_ts TIMESTAMPTZ;
BEGIN
  -- อนุญาตเฉพาะช่วงปิดเทอมใหญ่ (เมษายน–พฤษภาคม) เมื่อผู้ใช้กดเอง (cron ที่ไม่มี auth.uid() ข้ามได้)
  IF auth.uid() IS NOT NULL AND cur_month NOT IN (4, 5) THEN
    RAISE EXCEPTION 'อนุญาตให้ลบข้อมูลเก่าได้เฉพาะช่วงปิดเทอมใหญ่ (เมษายน–พฤษภาคม) เท่านั้น';
  END IF;

  -- ปีการศึกษาปัจจุบัน: ถ้าเดือน >= 5 ถือเป็นปีปฏิทินนั้น, มิฉะนั้นเป็นปีก่อนหน้า
  current_academic_year := CASE WHEN cur_month >= 5 THEN cur_year ELSE cur_year - 1 END;

  -- cutoff = ย้อนหลัง 6 เดือน แต่ต้องไม่ทับปีการศึกษาปัจจุบัน
  cutoff_ts := LEAST(
    now() - INTERVAL '6 months',
    make_date(current_academic_year, 5, 1)::timestamptz
  );

  WITH d AS (
    DELETE FROM public.notifications
    WHERE created_at < cutoff_ts AND is_read = true
    RETURNING 1
  )
  SELECT count(*) INTO notif_deleted FROM d;

  WITH d AS (
    DELETE FROM public.inbox_items
    WHERE created_at < cutoff_ts AND is_read = true
    RETURNING 1
  )
  SELECT count(*) INTO inbox_deleted FROM d;

  INSERT INTO public.school_settings (setting_key, setting_value)
  VALUES ('last_archive_run', jsonb_build_object(
    'ran_at', now(),
    'cutoff', cutoff_ts,
    'notifications_deleted', notif_deleted,
    'inbox_deleted', inbox_deleted
  )::text)
  ON CONFLICT (setting_key) DO UPDATE
    SET setting_value = EXCLUDED.setting_value, updated_at = now();

  RETURN jsonb_build_object(
    'notifications_deleted', notif_deleted,
    'inbox_deleted', inbox_deleted,
    'cutoff', cutoff_ts
  );
END;
$function$;


CREATE OR REPLACE FUNCTION public.archive_and_purge_old_data(_retention_years integer DEFAULT 3)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  cur_month int := EXTRACT(month FROM now())::int;
  cur_year int := EXTRACT(year FROM now())::int;
  current_academic_year int;
  cutoff_year int;
  cutoff_date date;
  res jsonb := '{}'::jsonb;
  cnt int;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director')) THEN
    RAISE EXCEPTION 'Forbidden: admin/director only';
  END IF;

  -- อนุญาตเฉพาะช่วงปิดเทอมใหญ่ (เมษายน–พฤษภาคม) เมื่อผู้ใช้กดเอง
  IF auth.uid() IS NOT NULL AND cur_month NOT IN (4, 5) THEN
    RAISE EXCEPTION 'อนุญาตให้ลบข้อมูลเก่าได้เฉพาะช่วงปิดเทอมใหญ่ (เมษายน–พฤษภาคม) เท่านั้น';
  END IF;

  current_academic_year := CASE WHEN cur_month >= 5 THEN cur_year ELSE cur_year - 1 END;

  cutoff_year := cur_year - _retention_years;
  -- กันไม่ให้ cutoff ทับปีการศึกษาปัจจุบัน (ต้องน้อยกว่าปีการศึกษาปัจจุบันอย่างน้อย 1 ปี)
  IF cutoff_year >= current_academic_year THEN
    cutoff_year := current_academic_year - 1;
  END IF;
  cutoff_date := (cutoff_year || '-01-01')::date;

  WITH d AS (DELETE FROM public.documents WHERE created_at < cutoff_date RETURNING 1)
  SELECT count(*) INTO cnt FROM d;
  res := res || jsonb_build_object('documents', cnt);

  WITH d AS (DELETE FROM public.eforms WHERE created_at < cutoff_date RETURNING 1)
  SELECT count(*) INTO cnt FROM d;
  res := res || jsonb_build_object('eforms', cnt);

  WITH d AS (DELETE FROM public.attendance WHERE COALESCE(academic_year, EXTRACT(year FROM created_at)::int) < cutoff_year RETURNING 1)
  SELECT count(*) INTO cnt FROM d;
  res := res || jsonb_build_object('attendance', cnt);

  WITH d AS (DELETE FROM public.behavior_records WHERE EXTRACT(year FROM record_date)::int < cutoff_year RETURNING 1)
  SELECT count(*) INTO cnt FROM d;
  res := res || jsonb_build_object('behavior_records', cnt);

  WITH d AS (DELETE FROM public.homeroom_records WHERE COALESCE(academic_year, EXTRACT(year FROM created_at)::int) < cutoff_year RETURNING 1)
  SELECT count(*) INTO cnt FROM d;
  res := res || jsonb_build_object('homeroom_records', cnt);

  WITH d AS (DELETE FROM public.pa_agreements WHERE COALESCE(academic_year, EXTRACT(year FROM created_at)::int) < cutoff_year RETURNING 1)
  SELECT count(*) INTO cnt FROM d;
  res := res || jsonb_build_object('pa_agreements', cnt);

  WITH d AS (DELETE FROM public.notifications WHERE created_at < cutoff_date RETURNING 1)
  SELECT count(*) INTO cnt FROM d;
  res := res || jsonb_build_object('notifications', cnt);

  WITH d AS (DELETE FROM public.inbox_items WHERE created_at < cutoff_date RETURNING 1)
  SELECT count(*) INTO cnt FROM d;
  res := res || jsonb_build_object('inbox_items', cnt);

  WITH d AS (DELETE FROM public.health_records WHERE EXTRACT(year FROM visit_date)::int < cutoff_year RETURNING 1)
  SELECT count(*) INTO cnt FROM d;
  res := res || jsonb_build_object('health_records', cnt);

  WITH d AS (DELETE FROM public.home_visits WHERE COALESCE(academic_year, EXTRACT(year FROM created_at)::int) < cutoff_year RETURNING 1)
  SELECT count(*) INTO cnt FROM d;
  res := res || jsonb_build_object('home_visits', cnt);

  WITH d AS (DELETE FROM public.emergency_broadcasts WHERE created_at < cutoff_date RETURNING 1)
  SELECT count(*) INTO cnt FROM d;
  res := res || jsonb_build_object('emergency_broadcasts', cnt);

  WITH d AS (DELETE FROM public.staff_leaves WHERE COALESCE(start_date, created_at::date) < cutoff_date RETURNING 1)
  SELECT count(*) INTO cnt FROM d;
  res := res || jsonb_build_object('staff_leaves', cnt);

  WITH d AS (DELETE FROM public.student_leaves WHERE COALESCE(start_date, created_at::date) < cutoff_date RETURNING 1)
  SELECT count(*) INTO cnt FROM d;
  res := res || jsonb_build_object('student_leaves', cnt);

  INSERT INTO public.archive_logs (ran_at, cutoff_year, retention_years, summary, ran_by)
  VALUES (now(), cutoff_year, _retention_years, res, auth.uid());

  res := res || jsonb_build_object('cutoff_year', cutoff_year, 'current_academic_year', current_academic_year);
  RETURN res;
END;
$function$;
