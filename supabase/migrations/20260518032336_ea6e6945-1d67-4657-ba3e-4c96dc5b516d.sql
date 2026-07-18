-- อนุญาตให้ผู้ใช้สร้าง personnel record ของตัวเองได้ (สำหรับ First Login Setup)
CREATE POLICY "Users can insert their own personnel record"
  ON public.personnel
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- อนุญาตให้ผู้ใช้แก้ไข personnel record ของตัวเองได้
-- ป้องกันการเปลี่ยน user_id ไปเป็นคนอื่นด้วย WITH CHECK
CREATE POLICY "Users can update their own personnel record"
  ON public.personnel
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());