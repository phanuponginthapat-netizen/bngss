-- เพิ่มฟิลด์ S/N และ barcode สำหรับสินทรัพย์
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS serial_number TEXT,
  ADD COLUMN IF NOT EXISTS barcode TEXT';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $idxguard$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_assets_serial_number ON public.assets(serial_number)';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
DO $idxguard$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_assets_barcode ON public.assets(barcode)';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
-- เปิด policy ให้ทุกคน (รวม anonymous) อ่านข้อมูลพื้นฐานสินทรัพย์ได้
-- เพื่อให้ผู้พบเห็นทรัพย์สินสแกน QR แล้วดูข้อมูลคืนของได้
DO $$ BEGIN
  CREATE POLICY "Public can view asset basics for return lookup"
    ON public.assets
    FOR SELECT
    TO anon, authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
