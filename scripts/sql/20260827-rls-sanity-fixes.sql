-- RLS sanity pass (27 ส.ค. 2569)
-- ลบ policy แบบ "true" ที่ทำให้โมเดลสิทธิ์เพี้ยน และปิดการอ่าน face_scan_logs แบบสาธารณะ

-- 1) face_scan_logs: ห้ามอ่านแบบเปิดกว้าง
DROP POLICY IF EXISTS "all authenticated can view scan logs" ON public.face_scan_logs;
DROP POLICY IF EXISTS "anon can view scan logs" ON public.face_scan_logs;

-- kiosk (anon) ต้องอ่านเฉพาะรายการวันนี้เพื่อกันสแกนซ้ำ
DROP POLICY IF EXISTS "kiosk can view today scan logs" ON public.face_scan_logs;
CREATE POLICY "kiosk can view today scan logs"
  ON public.face_scan_logs FOR SELECT TO anon
  USING (created_at > now() - interval '24 hours');

-- 2) คลังข้อมูลวิเคราะห์: เขียนได้เฉพาะ admin/ผอ., อ่านได้เฉพาะบุคลากร
DROP POLICY IF EXISTS "Authenticated can manage dim_student" ON public.dim_student;
DROP POLICY IF EXISTS "Authenticated can view dim_student" ON public.dim_student;
DROP POLICY IF EXISTS "Authenticated can manage fact_attendance" ON public.fact_attendance;
DROP POLICY IF EXISTS "Authenticated can manage fact_finance" ON public.fact_finance;
DROP POLICY IF EXISTS "Authenticated can view fact_finance" ON public.fact_finance;
DROP POLICY IF EXISTS "Authenticated can manage fact_grades" ON public.fact_grades;
DROP POLICY IF EXISTS "Authenticated can manage backup_snapshots" ON public.backup_snapshots;
DROP POLICY IF EXISTS "Authenticated can view backup_snapshots" ON public.backup_snapshots;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['dim_student','fact_attendance','fact_finance','fact_grades','backup_snapshots']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin_write', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_admin_or_director(auth.uid())) WITH CHECK (public.is_admin_or_director(auth.uid()))',
      t || '_admin_write', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "staff read dim_student" ON public.dim_student;
CREATE POLICY "staff read dim_student" ON public.dim_student
  FOR SELECT TO authenticated USING (public.is_staff_any(auth.uid()));
DROP POLICY IF EXISTS "staff read fact_grades" ON public.fact_grades;
CREATE POLICY "staff read fact_grades" ON public.fact_grades
  FOR SELECT TO authenticated USING (public.is_staff_any(auth.uid()));

-- 3) ตารางปฏิบัติงานที่เดิมให้ผู้ใช้ที่ล็อกอินทุกคนแก้ไขได้
DROP POLICY IF EXISTS "staff manage repairs" ON public.asset_repairs;
CREATE POLICY "staff manage repairs" ON public.asset_repairs
  FOR ALL TO authenticated
  USING (public.is_staff_any(auth.uid())) WITH CHECK (public.is_staff_any(auth.uid()));

DROP POLICY IF EXISTS "auth read bus" ON public.bus_routes;
DROP POLICY IF EXISTS "staff manage bus routes" ON public.bus_routes;
CREATE POLICY "staff manage bus routes" ON public.bus_routes
  FOR ALL TO authenticated
  USING (public.is_staff_any(auth.uid())) WITH CHECK (public.is_staff_any(auth.uid()));

DROP POLICY IF EXISTS "auth all lib loans" ON public.library_loans;
DROP POLICY IF EXISTS "staff manage lib loans" ON public.library_loans;
CREATE POLICY "staff manage lib loans" ON public.library_loans
  FOR ALL TO authenticated
  USING (public.is_staff_any(auth.uid())) WITH CHECK (public.is_staff_any(auth.uid()));

DROP POLICY IF EXISTS "auth all wpa" ON public.wpa_assessments;
DROP POLICY IF EXISTS "staff manage wpa" ON public.wpa_assessments;
CREATE POLICY "staff manage wpa" ON public.wpa_assessments
  FOR ALL TO authenticated
  USING (public.is_staff_any(auth.uid())) WITH CHECK (public.is_staff_any(auth.uid()));

DROP POLICY IF EXISTS "auth all offline_failed" ON public.offline_failed_queue;
DROP POLICY IF EXISTS "staff manage offline_failed" ON public.offline_failed_queue;
CREATE POLICY "staff manage offline_failed" ON public.offline_failed_queue
  FOR ALL TO authenticated
  USING (public.is_staff_any(auth.uid())) WITH CHECK (public.is_staff_any(auth.uid()));

-- 4) ตาราง dimension: อ่านได้ทุกคนที่ล็อกอิน แต่เขียนได้เฉพาะ admin/ผอ.
DROP POLICY IF EXISTS "Authenticated can manage dim_date" ON public.dim_date;
DROP POLICY IF EXISTS "Authenticated can manage dim_subject" ON public.dim_subject;
DROP POLICY IF EXISTS dim_date_admin_write ON public.dim_date;
CREATE POLICY dim_date_admin_write ON public.dim_date FOR ALL TO authenticated
  USING (public.is_admin_or_director(auth.uid())) WITH CHECK (public.is_admin_or_director(auth.uid()));
DROP POLICY IF EXISTS dim_subject_admin_write ON public.dim_subject;
CREATE POLICY dim_subject_admin_write ON public.dim_subject FOR ALL TO authenticated
  USING (public.is_admin_or_director(auth.uid())) WITH CHECK (public.is_admin_or_director(auth.uid()));
DROP POLICY IF EXISTS dim_date_read ON public.dim_date;
CREATE POLICY dim_date_read ON public.dim_date FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS dim_subject_read ON public.dim_subject;
CREATE POLICY dim_subject_read ON public.dim_subject FOR SELECT TO authenticated USING (true);
