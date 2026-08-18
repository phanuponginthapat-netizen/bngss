-- Face Texture Verification (LBP) — เพิ่มคอลัมน์ texture ให้ student_face_descriptors
-- texture คือเวกเตอร์ 944 มิติ (uniform LBP 4x4 บล็อก) คำนวณฝั่ง client ตอนลงทะเบียน
-- ใช้ตรวจยืนยัน "พื้นผิวใบหน้า" ตอนสแกน เพื่อกันคนหน้าคล้ายกันและรูปถ่าย

ALTER TABLE public.student_face_descriptors
  ADD COLUMN IF NOT EXISTS texture REAL[];

ALTER TABLE public.personnel_face_descriptors
  ADD COLUMN IF NOT EXISTS texture REAL[];