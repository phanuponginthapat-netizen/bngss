-- ครู/บุคลากร และผู้ใช้ที่ล็อกอิน อ่านข้อมูลห้องเรียนได้ (ยังถูกจำกัดด้วย school_scope_restrictive)
-- แก้: รายงานการสแกนของ role ครู ขึ้นแค่แถวสรุปเดียว เพราะอ่าน classrooms ไม่ได้
DROP POLICY IF EXISTS "Staff view classrooms" ON public.classrooms;
CREATE POLICY "Staff view classrooms" ON public.classrooms
  FOR SELECT TO authenticated USING (public.is_staff_any(auth.uid()));

DROP POLICY IF EXISTS "Authenticated view classrooms" ON public.classrooms;
CREATE POLICY "Authenticated view classrooms" ON public.classrooms
  FOR SELECT TO authenticated USING (true);

GRANT SELECT ON public.classrooms TO authenticated;
