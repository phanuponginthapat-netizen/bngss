-- 1) Bucket สำหรับ archive ข้อมูลเก่า (private — เฉพาะ admin)
INSERT INTO storage.buckets (id, name, public)
VALUES ('cold-archive', 'cold-archive', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Admin/Director read cold-archive" ON storage.objects;
CREATE POLICY "Admin/Director read cold-archive"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'cold-archive' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director')));

DROP POLICY IF EXISTS "Admin/Director write cold-archive" ON storage.objects;
CREATE POLICY "Admin/Director write cold-archive"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'cold-archive' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director')));

DROP POLICY IF EXISTS "Admin/Director update cold-archive" ON storage.objects;
CREATE POLICY "Admin/Director update cold-archive"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'cold-archive' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director')));

DROP POLICY IF EXISTS "Admin can delete cold-archive" ON storage.objects;
CREATE POLICY "Admin can delete cold-archive"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'cold-archive' AND public.has_role(auth.uid(),'admin'));

-- 2) ตาราง archive_logs — ประวัติการ archive
CREATE TABLE IF NOT EXISTS public.archive_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at timestamp with time zone NOT NULL DEFAULT now(),
  ran_by uuid,
  cutoff_year integer NOT NULL,
  retention_years integer NOT NULL DEFAULT 3,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  archive_path text
);

ALTER TABLE public.archive_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin/Director view archive_logs" ON public.archive_logs;
CREATE POLICY "Admin/Director view archive_logs"
ON public.archive_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));

DROP POLICY IF EXISTS "Admin/Director insert archive_logs" ON public.archive_logs;
CREATE POLICY "Admin/Director insert archive_logs"
ON public.archive_logs FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));

-- 3) ฟังก์ชันลบข้อมูลเก่ากว่า 3 ปีการศึกษา
CREATE OR REPLACE FUNCTION public.archive_and_purge_old_data(_retention_years int DEFAULT 3)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_year int;
  cutoff_year int;
  cutoff_date date;
  res jsonb := '{}'::jsonb;
  cnt int;
BEGIN
  -- อนุญาตเฉพาะ admin/director (ยกเว้นถูกเรียกจาก cron job ที่ไม่มี auth.uid())
  IF auth.uid() IS NOT NULL AND NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director')) THEN
    RAISE EXCEPTION 'Forbidden: admin/director only';
  END IF;

  current_year := EXTRACT(year FROM now())::int;
  cutoff_year := current_year - _retention_years;
  cutoff_date := (cutoff_year || '-01-01')::date;

  -- Documents (และ document_recipients ลบแบบ cascade)
  WITH d AS (DELETE FROM public.documents WHERE created_at < cutoff_date RETURNING 1)
  SELECT count(*) INTO cnt FROM d;
  res := res || jsonb_build_object('documents', cnt);

  -- Eforms (cascade ลบ recipients/attachments)
  WITH d AS (DELETE FROM public.eforms WHERE created_at < cutoff_date RETURNING 1)
  SELECT count(*) INTO cnt FROM d;
  res := res || jsonb_build_object('eforms', cnt);

  -- Attendance / Behavior / Homeroom (ใช้ academic_year)
  WITH d AS (DELETE FROM public.attendance WHERE COALESCE(academic_year, EXTRACT(year FROM created_at)::int) < cutoff_year RETURNING 1)
  SELECT count(*) INTO cnt FROM d;
  res := res || jsonb_build_object('attendance', cnt);

  WITH d AS (DELETE FROM public.behavior_records WHERE EXTRACT(year FROM record_date)::int < cutoff_year RETURNING 1)
  SELECT count(*) INTO cnt FROM d;
  res := res || jsonb_build_object('behavior_records', cnt);

  WITH d AS (DELETE FROM public.homeroom_records WHERE COALESCE(academic_year, EXTRACT(year FROM created_at)::int) < cutoff_year RETURNING 1)
  SELECT count(*) INTO cnt FROM d;
  res := res || jsonb_build_object('homeroom_records', cnt);

  -- PA agreements (cascade ลบ indicator_scores)
  WITH d AS (DELETE FROM public.pa_agreements WHERE COALESCE(academic_year, EXTRACT(year FROM created_at)::int) < cutoff_year RETURNING 1)
  SELECT count(*) INTO cnt FROM d;
  res := res || jsonb_build_object('pa_agreements', cnt);

  -- Notifications & Inbox (ทั้งหมดที่เก่ากว่า cutoff)
  WITH d AS (DELETE FROM public.notifications WHERE created_at < cutoff_date RETURNING 1)
  SELECT count(*) INTO cnt FROM d;
  res := res || jsonb_build_object('notifications', cnt);

  WITH d AS (DELETE FROM public.inbox_items WHERE created_at < cutoff_date RETURNING 1)
  SELECT count(*) INTO cnt FROM d;
  res := res || jsonb_build_object('inbox_items', cnt);

  -- Health & home visits & emergency
  WITH d AS (DELETE FROM public.health_records WHERE EXTRACT(year FROM visit_date)::int < cutoff_year RETURNING 1)
  SELECT count(*) INTO cnt FROM d;
  res := res || jsonb_build_object('health_records', cnt);

  WITH d AS (DELETE FROM public.home_visits WHERE EXTRACT(year FROM visit_date)::int < cutoff_year RETURNING 1)
  SELECT count(*) INTO cnt FROM d;
  res := res || jsonb_build_object('home_visits', cnt);

  WITH d AS (DELETE FROM public.emergency_broadcasts WHERE created_at < cutoff_date RETURNING 1)
  SELECT count(*) INTO cnt FROM d;
  res := res || jsonb_build_object('emergency_broadcasts', cnt);

  WITH d AS (DELETE FROM public.district_feed_logs WHERE created_at < cutoff_date RETURNING 1)
  SELECT count(*) INTO cnt FROM d;
  res := res || jsonb_build_object('district_feed_logs', cnt);

  -- บันทึก log
  INSERT INTO public.archive_logs (ran_by, cutoff_year, retention_years, summary)
  VALUES (auth.uid(), cutoff_year, _retention_years, res);

  RETURN jsonb_build_object(
    'success', true,
    'cutoff_year', cutoff_year,
    'retention_years', _retention_years,
    'deleted', res
  );
END;
$$;

-- 4) RPC สำหรับ admin ดูจำนวนข้อมูลที่จะถูกลบ (preview)
CREATE OR REPLACE FUNCTION public.get_purge_preview(_retention_years int DEFAULT 3)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cutoff_year int;
  cutoff_date date;
  res jsonb := '{}'::jsonb;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  cutoff_year := EXTRACT(year FROM now())::int - _retention_years;
  cutoff_date := (cutoff_year || '-01-01')::date;

  res := jsonb_build_object(
    'cutoff_year', cutoff_year,
    'documents', (SELECT count(*) FROM public.documents WHERE created_at < cutoff_date),
    'eforms', (SELECT count(*) FROM public.eforms WHERE created_at < cutoff_date),
    'attendance', (SELECT count(*) FROM public.attendance WHERE COALESCE(academic_year, EXTRACT(year FROM created_at)::int) < cutoff_year),
    'behavior_records', (SELECT count(*) FROM public.behavior_records WHERE EXTRACT(year FROM record_date)::int < cutoff_year),
    'homeroom_records', (SELECT count(*) FROM public.homeroom_records WHERE COALESCE(academic_year, EXTRACT(year FROM created_at)::int) < cutoff_year),
    'pa_agreements', (SELECT count(*) FROM public.pa_agreements WHERE COALESCE(academic_year, EXTRACT(year FROM created_at)::int) < cutoff_year),
    'notifications', (SELECT count(*) FROM public.notifications WHERE created_at < cutoff_date),
    'inbox_items', (SELECT count(*) FROM public.inbox_items WHERE created_at < cutoff_date),
    'health_records', (SELECT count(*) FROM public.health_records WHERE EXTRACT(year FROM visit_date)::int < cutoff_year),
    'home_visits', (SELECT count(*) FROM public.home_visits WHERE EXTRACT(year FROM visit_date)::int < cutoff_year),
    'emergency_broadcasts', (SELECT count(*) FROM public.emergency_broadcasts WHERE created_at < cutoff_date)
  );
  RETURN res;
END;
$$;

-- 5) RPC ดูปีการศึกษาทั้งหมดที่มีข้อมูลในระบบ
CREATE OR REPLACE FUNCTION public.get_available_academic_years()
RETURNS int[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT array_agg(DISTINCT y ORDER BY y DESC)
  FROM (
    SELECT academic_year AS y FROM public.attendance WHERE academic_year IS NOT NULL
    UNION SELECT academic_year FROM public.enrollments WHERE academic_year IS NOT NULL
    UNION SELECT academic_year FROM public.pa_agreements WHERE academic_year IS NOT NULL
    UNION SELECT academic_year FROM public.homeroom_records WHERE academic_year IS NOT NULL
    UNION SELECT EXTRACT(year FROM doc_date)::int FROM public.documents
    UNION SELECT EXTRACT(year FROM created_at)::int FROM public.eforms
  ) t
  WHERE y IS NOT NULL AND y >= EXTRACT(year FROM now())::int - 3;
$$;