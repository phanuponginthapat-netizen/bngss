
ALTER TABLE public.student_face_descriptors
  ADD COLUMN IF NOT EXISTS embedding_v2 real[],
  ADD COLUMN IF NOT EXISTS model_version text NOT NULL DEFAULT 'face-api-v1';

CREATE INDEX IF NOT EXISTS idx_student_face_descriptors_model_version
  ON public.student_face_descriptors (student_id, model_version);

COMMENT ON COLUMN public.student_face_descriptors.embedding_v2 IS
  '512-dim ArcFace (InsightFace buffalo_s / MobileFaceNet) L2-normalized embedding. NULL = ยังไม่ได้คำนวณ (descriptor เก่าใช้ face-api 128-dim เท่านั้น)';
COMMENT ON COLUMN public.student_face_descriptors.model_version IS
  'face-api-v1 (128-dim) หรือ arcface-mbf-v1 (512-dim + face-api fallback). คนใหม่ลงทะเบียนจะได้ arcface-mbf-v1';
