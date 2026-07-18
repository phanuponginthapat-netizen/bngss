-- เพิ่มฟิลด์ S/N และ barcode สำหรับสินทรัพย์
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS serial_number TEXT,
  ADD COLUMN IF NOT EXISTS barcode TEXT;

CREATE INDEX IF NOT EXISTS idx_assets_serial_number ON public.assets(serial_number);
CREATE INDEX IF NOT EXISTS idx_assets_barcode ON public.assets(barcode);

-- เปิด policy ให้ทุกคน (รวม anonymous) อ่านข้อมูลพื้นฐานสินทรัพย์ได้
-- เพื่อให้ผู้พบเห็นทรัพย์สินสแกน QR แล้วดูข้อมูลคืนของได้
DO $$ BEGIN
  CREATE POLICY "Public can view asset basics for return lookup"
    ON public.assets
    FOR SELECT
    TO anon, authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;