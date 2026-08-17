-- เพิ่มฟิลด์รูปให้ garbage_items
ALTER TABLE public.garbage_items ADD COLUMN IF NOT EXISTS image_url TEXT;

-- สร้าง bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('garbage-images', 'garbage-images', true)
ON CONFLICT (id) DO NOTHING;

-- Public read
DROP POLICY IF EXISTS "garbage_images_public_read" ON storage.objects;
CREATE POLICY "garbage_images_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'garbage-images');

-- Staff manage (insert/update/delete)
DROP POLICY IF EXISTS "garbage_images_staff_insert" ON storage.objects;
CREATE POLICY "garbage_images_staff_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'garbage-images'
    AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director') OR has_role(auth.uid(),'teacher'))
  );

DROP POLICY IF EXISTS "garbage_images_staff_update" ON storage.objects;
CREATE POLICY "garbage_images_staff_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'garbage-images'
    AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director') OR has_role(auth.uid(),'teacher'))
  );

DROP POLICY IF EXISTS "garbage_images_staff_delete" ON storage.objects;
CREATE POLICY "garbage_images_staff_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'garbage-images'
    AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director') OR has_role(auth.uid(),'teacher'))
  );