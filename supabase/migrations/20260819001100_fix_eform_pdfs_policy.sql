-- แก้ 22P02 ให้ครบ: policy eform-pdfs ยังแคสต์โฟลเดอร์แรกเป็น uuid โดยไม่ตรวจรูปแบบ
-- (เช่นเดียวกับ padlet "covers" ที่แก้ใน 20260819001000)

DROP POLICY IF EXISTS "eform-pdfs recipient can read" ON storage.objects;
CREATE POLICY "eform-pdfs recipient can read" ON storage.objects FOR SELECT
USING (bucket_id = 'eform-pdfs'
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  AND can_access_eform(((storage.foldername(name))[1])::uuid, auth.uid()));