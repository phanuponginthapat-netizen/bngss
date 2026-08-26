-- ตู้ kiosk door (anon/ทุก user) ต้อง insert face_scan_logs ได้เพื่อบันทึกเข้าโรงเรียน
-- เดิม: staff manage scan logs FOR ALL TO authenticated USING has_role(teacher/admin/director) → ตู้ anon insert ไม่ได้
-- เพิ่ม: ให้ anon + authenticated ทุกคน insert ได้ (kiosk อยู่โรงเรียน ปลอดภัยทางกายภาพ)
DO $$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "kiosk can insert scan logs" ON public.face_scan_logs';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "kiosk can insert scan logs"
ON public.face_scan_logs
FOR INSERT TO anon, authenticated
WITH CHECK (true);

-- ให้ anon อ่านได้ด้วย (สแกนล่าสุดจะได้ขึ้นบนตู้ที่ยังไม่ login)
DO $$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "anon can view scan logs" ON public.face_scan_logs';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
-- มีแล้วจาก 20260826160000 แต่กันพลาดสร้างซ้ำแบบ idempotent
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='face_scan_logs' AND policyname='anon can view scan logs') THEN
    EXECUTE 'CREATE POLICY "anon can view scan logs" ON public.face_scan_logs FOR SELECT TO anon USING (true)';
  END IF;
END $$;
