
-- 1) alumni_university: ลบสิทธิ์ teacher อ่านข้อมูลศิษย์เก่า เหลือเฉพาะ admin/director/self
DROP POLICY IF EXISTS alumni_uni_read_scoped ON public.alumni_university;
DROP POLICY IF EXISTS alumni_uni_self_manage ON public.alumni_university;
CREATE POLICY alumni_uni_read_scoped ON public.alumni_university
  FOR SELECT TO authenticated
  USING (alumni_user_id = auth.uid()
         OR has_role(auth.uid(), 'admin'::app_role)
         OR has_role(auth.uid(), 'director'::app_role));
CREATE POLICY alumni_uni_self_manage ON public.alumni_university
  FOR ALL TO authenticated
  USING (alumni_user_id = auth.uid()
         OR has_role(auth.uid(), 'admin'::app_role)
         OR has_role(auth.uid(), 'director'::app_role))
  WITH CHECK (alumni_user_id = auth.uid()
              OR has_role(auth.uid(), 'admin'::app_role)
              OR has_role(auth.uid(), 'director'::app_role));

-- 2) personnel: ลบสิทธิ์ observer ดู PII (เบอร์/อีเมล)
DROP POLICY IF EXISTS "Observers can view" ON public.personnel;

-- 3) admissions: ลบสิทธิ์ observer ดูข้อมูลผู้ปกครอง
DROP POLICY IF EXISTS "Observers can view" ON public.admissions;

-- 4) mou_records: จำกัด SELECT เฉพาะ admin/director (เพราะมี partner_contact)
DROP POLICY IF EXISTS mou_read_all_staff ON public.mou_records;
DROP POLICY IF EXISTS "Observers can view" ON public.mou_records;
CREATE POLICY mou_read_admin_director ON public.mou_records
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)
         OR has_role(auth.uid(), 'director'::app_role));

-- 5) student_enrollment_history: จำกัดเฉพาะบุคลากร (admin/director/teacher/observer)
DROP POLICY IF EXISTS enrollment_history_read_authenticated ON public.student_enrollment_history;
CREATE POLICY enrollment_history_read_staff ON public.student_enrollment_history
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)
         OR has_role(auth.uid(), 'director'::app_role)
         OR has_role(auth.uid(), 'teacher'::app_role)
         OR has_role(auth.uid(), 'observer'::app_role));
