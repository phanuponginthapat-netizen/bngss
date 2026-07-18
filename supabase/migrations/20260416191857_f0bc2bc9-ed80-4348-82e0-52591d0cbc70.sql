
-- เพิ่มฟิลด์สำหรับติดตามสถานะการผูกบัญชี Google และ LINE
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS google_email TEXT,
  ADD COLUMN IF NOT EXISTS account_linked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS linked_at TIMESTAMP WITH TIME ZONE;

-- ยืดหยุ่นเริ่มต้นให้บัญชีใหม่ที่สมัครผ่าน Google ยังไม่ผูก (ต้องไปกรอกรหัสที่หน้าผูกบัญชี)
COMMENT ON COLUMN public.profiles.account_linked IS 'true เมื่อผู้ใช้กรอกรหัสนักเรียน/บุคลากรและผูกกับโปรไฟล์เรียบร้อย';
COMMENT ON COLUMN public.profiles.google_email IS 'อีเมล Google ที่ผู้ใช้ใช้ login';

-- Index สำหรับ academic_events ICS feed
CREATE INDEX IF NOT EXISTS idx_academic_events_date ON public.academic_events(event_date);

-- Public read สำหรับ ICS feed (ใช้ token ใน edge function แทน RLS)
-- ไม่ต้องเปลี่ยน RLS เพราะ edge function ใช้ service role
