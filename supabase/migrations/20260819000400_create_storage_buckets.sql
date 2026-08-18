-- สร้าง storage buckets ที่ frontend ใช้งานแต่ยังไม่มี migration (มีอยู่แล้วบนโปรเจกต์เก่า)

-- กลุ่ม 1: ผู้ใช้ทั่วไป (authenticated) อ่าน-อัปโหลดได้ (รูป/ไฟล์งานนักเรียน)
DO $$
DECLARE b text;
BEGIN
  FOREACH b IN ARRAY ARRAY['homework-files','padlet','portfolio','wall-media','hub-projects','offsite-photos','task-attachments'] LOOP
    INSERT INTO storage.buckets (id, name, public)
    VALUES (b, b, false)
    ON CONFLICT (id) DO NOTHING;

    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b||' auth read');
    EXECUTE format('CREATE POLICY %I ON storage.objects FOR SELECT TO authenticated USING (bucket_id = %L)', b||' auth read', b);
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b||' auth insert');
    EXECUTE format('CREATE POLICY %I ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = %L)', b||' auth insert', b);
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b||' auth update');
    EXECUTE format('CREATE POLICY %I ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = %L)', b||' auth update', b);
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b||' auth delete');
    EXECUTE format('CREATE POLICY %I ON storage.objects FOR DELETE TO authenticated USING (bucket_id = %L)', b||' auth delete', b);
  END LOOP;
END $$;

-- กลุ่ม 2: อ่านได้ทุกคน (authenticated) แต่เฉพาะ staff อัปโหลด (เอกสารราชการ/แม่แบบ)
DO $$
DECLARE b text;
BEGIN
  FOREACH b IN ARRAY ARRAY['print-templates','eform-pdfs','substitute-proof','leave-attachments','game-covers'] LOOP
    INSERT INTO storage.buckets (id, name, public)
    VALUES (b, b, false)
    ON CONFLICT (id) DO NOTHING;

    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b||' staff read');
    EXECUTE format('CREATE POLICY %I ON storage.objects FOR SELECT TO authenticated USING (bucket_id = %L AND public.is_staff_user(auth.uid()))', b||' staff read', b);
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b||' staff insert');
    EXECUTE format('CREATE POLICY %I ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = %L AND public.is_staff_user(auth.uid()))', b||' staff insert', b);
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b||' staff update');
    EXECUTE format('CREATE POLICY %I ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = %L AND public.is_staff_user(auth.uid()))', b||' staff update', b);
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b||' staff delete');
    EXECUTE format('CREATE POLICY %I ON storage.objects FOR DELETE TO authenticated USING (bucket_id = %L AND public.is_staff_user(auth.uid()))', b||' staff delete', b);
  END LOOP;
END $$;

-- camera-events: staff อ่าน snapshot ได้ (mirror จาก 20260817-wizmind-bridge.sql)
-- bucket ถูกสร้างใน scripts/sql/20260817-wizmind-bridge.sql → ย้ายเข้า migration ให้ครบ
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('camera-events','camera-events', false, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
DROP POLICY IF EXISTS "camera events staff read" ON storage.objects;
CREATE POLICY "camera events staff read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'camera-events' AND public.is_staff_user(auth.uid()));

-- exam-scans: ใช้ getPublicUrl ใน frontend (ExamScanPage.tsx:50,76) → ต้องเป็น public bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('exam-scans', 'exam-scans', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;
DROP POLICY IF EXISTS "exam scans public read" ON storage.objects;
CREATE POLICY "exam scans public read" ON storage.objects FOR SELECT USING (bucket_id = 'exam-scans');
DROP POLICY IF EXISTS "exam scans staff insert" ON storage.objects;
CREATE POLICY "exam scans staff insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'exam-scans' AND public.is_staff_user(auth.uid()));
DROP POLICY IF EXISTS "exam scans staff delete" ON storage.objects;
CREATE POLICY "exam scans staff delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'exam-scans' AND public.is_staff_user(auth.uid()));

-- line-vault: admin/director/teacher เท่านั้น (ดู sidebar roles) — อ่าน/เขียน/ลบได้
INSERT INTO storage.buckets (id, name, public)
VALUES ('line-vault', 'line-vault', false)
ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "line vault teacher read" ON storage.objects;
CREATE POLICY "line vault teacher read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'line-vault' AND (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'director'::public.app_role) OR public.has_role(auth.uid(),'teacher'::public.app_role)));
DROP POLICY IF EXISTS "line vault teacher insert" ON storage.objects;
CREATE POLICY "line vault teacher insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'line-vault' AND (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'director'::public.app_role) OR public.has_role(auth.uid(),'teacher'::public.app_role)));
DROP POLICY IF EXISTS "line vault teacher update" ON storage.objects;
CREATE POLICY "line vault teacher update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'line-vault' AND (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'director'::public.app_role) OR public.has_role(auth.uid(),'teacher'::public.app_role)));
DROP POLICY IF EXISTS "line vault teacher delete" ON storage.objects;
CREATE POLICY "line vault teacher delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'line-vault' AND (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'director'::public.app_role) OR public.has_role(auth.uid(),'teacher'::public.app_role)));