-- ให้ทุก user ที่ login แล้วเห็นรายงานสแกนล่าสุดเหมือนกันหมด (ตามคำขอ: ทุก platform เห็นทั้งหมด)
-- เดิม: staff=ทั้งหมด, student=ของตัวเอง, parent=ของลูก → นักเรียน/ผู้ปกครองทั่วไปเห็นไม่ครบ
-- ใหม่: เพิ่ม policy ให้ authenticated ทุกคน SELECT ได้ทั้งหมด (OR กับ policy เดิม)

DO $$
BEGIN
  -- ลบ policy เก่าถ้าเคยสร้างไว้ (idempotent)
  EXECUTE 'DROP POLICY IF EXISTS "all authenticated can view scan logs" ON public.face_scan_logs';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "all authenticated can view scan logs"
ON public.face_scan_logs
FOR SELECT TO authenticated
USING (true);
