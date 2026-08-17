-- เพิ่มฟิลด์สำหรับติดตามสถานะการผูกบัญชี Google และ LINE
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS google_email TEXT,
  ADD COLUMN IF NOT EXISTS account_linked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS linked_at TIMESTAMP WITH TIME ZONE';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- ยืดหยุ่นเริ่มต้นให้บัญชีใหม่ที่สมัครผ่าน Google ยังไม่ผูก (ต้องไปกรอกรหัสที่หน้าผูกบัญชี)
DO $guard$
BEGIN
  EXECUTE 'COMMENT ON COLUMN public.profiles.account_linked IS ''true เมื่อผู้ใช้กรอกรหัสนักเรียน/บุคลากรและผูกกับโปรไฟล์เรียบร้อย''';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'COMMENT ON COLUMN public.profiles.google_email IS ''อีเมล Google ที่ผู้ใช้ใช้ login''';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- Index สำหรับ academic_events ICS feed
DO $idxguard$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_academic_events_date ON public.academic_events(event_date)';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
-- Public read สำหรับ ICS feed (ใช้ token ใน edge function แทน RLS)
-- ไม่ต้องเปลี่ยน RLS เพราะ edge function ใช้ service role
