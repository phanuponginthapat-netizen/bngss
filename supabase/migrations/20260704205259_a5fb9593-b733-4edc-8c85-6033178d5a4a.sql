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
  IF auth.uid() IS NOT NULL AND cur_month NOT IN (4, 5) THEN
    RAISE EXCEPTION 'อนุญาตให้ลบข้อมูลเก่าได้เฉพาะช่วงปิดเทอมใหญ่ (เมษายน–พฤษภาคม) เท่านั้น';
  END IF;

  current_academic_year := CASE WHEN cur_month >= 5 THEN cur_year ELSE cur_year - 1 END;
  cutoff_year := cur_year - _retention_years;
  IF cutoff_year >= current_academic_year THEN
    cutoff_year := current_academic_year - 1;
  END IF;
  cutoff_date := (cutoff_year || '-01-01')::date;

  WITH d AS (DELETE FROM public.documents WHERE created_at < cutoff_date RETURNING 1) SELECT count(*) INTO cnt FROM d; res := res || jsonb_build_object('documents', cnt);
  WITH d AS (DELETE FROM public.eforms WHERE created_at < cutoff_date RETURNING 1) SELECT count(*) INTO cnt FROM d; res := res || jsonb_build_object('eforms', cnt);
  WITH d AS (DELETE FROM public.attendance WHERE COALESCE(academic_year, EXTRACT(year FROM created_at)::int) < cutoff_year RETURNING 1) SELECT count(*) INTO cnt FROM d; res := res || jsonb_build_object('attendance', cnt);
  WITH d AS (DELETE FROM public.behavior_records WHERE EXTRACT(year FROM record_date)::int < cutoff_year RETURNING 1) SELECT count(*) INTO cnt FROM d; res := res || jsonb_build_object('behavior_records', cnt);
  WITH d AS (DELETE FROM public.homeroom_records WHERE COALESCE(academic_year, EXTRACT(year FROM created_at)::int) < cutoff_year RETURNING 1) SELECT count(*) INTO cnt FROM d; res := res || jsonb_build_object('homeroom_records', cnt);
  WITH d AS (DELETE FROM public.pa_agreements WHERE COALESCE(academic_year, EXTRACT(year FROM created_at)::int) < cutoff_year RETURNING 1) SELECT count(*) INTO cnt FROM d; res := res || jsonb_build_object('pa_agreements', cnt);
  WITH d AS (DELETE FROM public.notifications WHERE created_at < cutoff_date RETURNING 1) SELECT count(*) INTO cnt FROM d; res := res || jsonb_build_object('notifications', cnt);
  WITH d AS (DELETE FROM public.inbox_items WHERE created_at < cutoff_date RETURNING 1) SELECT count(*) INTO cnt FROM d; res := res || jsonb_build_object('inbox_items', cnt);
  WITH d AS (DELETE FROM public.health_records WHERE EXTRACT(year FROM visit_date)::int < cutoff_year RETURNING 1) SELECT count(*) INTO cnt FROM d; res := res || jsonb_build_object('health_records', cnt);
  WITH d AS (DELETE FROM public.home_visits WHERE COALESCE(academic_year, EXTRACT(year FROM created_at)::int) < cutoff_year RETURNING 1) SELECT count(*) INTO cnt FROM d; res := res || jsonb_build_object('home_visits', cnt);
  WITH d AS (DELETE FROM public.emergency_broadcasts WHERE created_at < cutoff_date RETURNING 1) SELECT count(*) INTO cnt FROM d; res := res || jsonb_build_object('emergency_broadcasts', cnt);
  WITH d AS (DELETE FROM public.staff_leaves WHERE COALESCE(start_date, created_at::date) < cutoff_date RETURNING 1) SELECT count(*) INTO cnt FROM d; res := res || jsonb_build_object('staff_leaves', cnt);
  WITH d AS (DELETE FROM public.student_leaves WHERE COALESCE(start_date, created_at::date) < cutoff_date RETURNING 1) SELECT count(*) INTO cnt FROM d; res := res || jsonb_build_object('student_leaves', cnt);
  WITH d AS (DELETE FROM public.face_scan_logs WHERE scan_date < cutoff_date RETURNING 1) SELECT count(*) INTO cnt FROM d; res := res || jsonb_build_object('face_scan_logs', cnt);
  WITH d AS (DELETE FROM public.ai_chat_logs WHERE created_at < cutoff_date RETURNING 1) SELECT count(*) INTO cnt FROM d; res := res || jsonb_build_object('ai_chat_logs', cnt);
  WITH d AS (DELETE FROM public.browser_logs WHERE created_at < cutoff_date RETURNING 1) SELECT count(*) INTO cnt FROM d; res := res || jsonb_build_object('browser_logs', cnt);
  WITH d AS (DELETE FROM public.error_logs WHERE created_at < cutoff_date RETURNING 1) SELECT count(*) INTO cnt FROM d; res := res || jsonb_build_object('error_logs', cnt);

  INSERT INTO public.archive_logs (ran_at, cutoff_year, retention_years, summary, ran_by)
  VALUES (now(), cutoff_year, _retention_years, res, auth.uid());

  res := res || jsonb_build_object('cutoff_year', cutoff_year, 'current_academic_year', current_academic_year);
  RETURN res;
END;
$function$;
DO $guard$
BEGIN
  EXECUTE 'REVOKE ALL ON FUNCTION public.archive_and_purge_old_data(integer) FROM PUBLIC, anon, authenticated';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
