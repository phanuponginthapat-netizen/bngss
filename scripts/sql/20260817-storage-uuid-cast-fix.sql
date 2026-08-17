-- แก้ 22P02 invalid input syntax for type uuid: "covers"
-- นโยบาย storage แคสต์ชื่อโฟลเดอร์แรกเป็น uuid โดยไม่ตรวจรูปแบบ ทำให้ path เช่น covers/<uid>/file.jpg พัง
DROP POLICY IF EXISTS padlet_read_board_viewers ON storage.objects;
CREATE POLICY padlet_read_board_viewers ON storage.objects FOR SELECT
USING (bucket_id = 'padlet'
  AND split_part(name,'/',1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  AND padlet_can_view_board(split_part(name,'/',1)::uuid));

DROP POLICY IF EXISTS padlet_upload_own_folder_board_viewers ON storage.objects;
CREATE POLICY padlet_upload_own_folder_board_viewers ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'padlet'
  AND split_part(name,'/',2) = auth.uid()::text
  AND (split_part(name,'/',1) !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
       OR padlet_can_view_board(split_part(name,'/',1)::uuid)));

DROP POLICY IF EXISTS "eform attach: sender or recipient can view" ON storage.objects;
CREATE POLICY "eform attach: sender or recipient can view" ON storage.objects FOR SELECT
USING (bucket_id = 'eform-attachments'
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  AND can_access_eform_attachment(((storage.foldername(name))[1])::uuid, auth.uid()));
