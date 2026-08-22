-- Fix: ensure observation tables exist (20260822100000 was marked applied but tables missing due to FK error)
CREATE TABLE IF NOT EXISTS public.observer_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  token text NOT NULL UNIQUE,
  observer_name text NOT NULL,
  observer_role text DEFAULT 'ศึกษานิเทศก์',
  created_by uuid REFERENCES auth.users(id),
  expires_at timestamptz NOT NULL,
  max_uses integer DEFAULT 1,
  use_count integer DEFAULT 0,
  is_active boolean DEFAULT true,
  note text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.observer_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage observer tokens" ON public.observer_tokens;
CREATE POLICY "Admins manage observer tokens" ON public.observer_tokens FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE TABLE IF NOT EXISTS public.observation_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  observer_token_id uuid REFERENCES public.observer_tokens(id),
  teacher_id uuid NOT NULL REFERENCES auth.users(id),
  classroom text,
  subject text,
  scheduled_date date NOT NULL DEFAULT CURRENT_DATE,
  scheduled_time text,
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.observation_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Teachers view own observation sessions" ON public.observation_sessions;
CREATE POLICY "Teachers view own observation sessions" ON public.observation_sessions FOR SELECT USING (
  auth.uid() = teacher_id OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'director'))
);
DROP POLICY IF EXISTS "Admins manage observation sessions" ON public.observation_sessions;
CREATE POLICY "Admins manage observation sessions" ON public.observation_sessions FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'director'))
);

CREATE TABLE IF NOT EXISTS public.observation_rubrics (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL DEFAULT 'OBEC 5 ขั้นตอนการจัดการเรียนรู้',
  description text,
  criteria jsonb NOT NULL DEFAULT '[]',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.observation_rubrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated can read rubrics" ON public.observation_rubrics;
CREATE POLICY "Authenticated can read rubrics" ON public.observation_rubrics FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Admins manage rubrics" ON public.observation_rubrics;
CREATE POLICY "Admins manage rubrics" ON public.observation_rubrics FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE TABLE IF NOT EXISTS public.observation_records (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.observation_sessions(id) ON DELETE CASCADE,
  rubric_id uuid NOT NULL REFERENCES public.observation_rubrics(id),
  teacher_id uuid NOT NULL REFERENCES auth.users(id),
  scores jsonb NOT NULL DEFAULT '{}',
  total_score numeric,
  max_score numeric,
  overall_comment text,
  strengths text,
  suggestions text,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'acknowledged')),
  observed_at timestamptz DEFAULT now(),
  submitted_at timestamptz,
  acknowledged_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.observation_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Teachers view own observation records" ON public.observation_records;
CREATE POLICY "Teachers view own observation records" ON public.observation_records FOR SELECT USING (
  auth.uid() = teacher_id OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'director'))
);
DROP POLICY IF EXISTS "Observers can insert observation records" ON public.observation_records;
CREATE POLICY "Observers can insert observation records" ON public.observation_records FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Admins manage observation records" ON public.observation_records;
CREATE POLICY "Admins manage observation records" ON public.observation_records FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'director'))
);

INSERT INTO public.observation_rubrics (name, description, criteria)
SELECT
  'OBEC 5 ขั้นตอนการจัดการเรียนรู้',
  'แบบประเมินการสังเกตการสอนตามแนวปฏิบัติ สพฐ. (5 ขั้นตอน + การจัดการชั้นเรียน)',
  '[
    {"id": "step1", "name": "ขั้นตอนที่ 1: ขั้นนำ (Motivation)", "description": "สร้างความสนใจ motivation สอดคล้องกับเนื้อหา", "max_score": 5},
    {"id": "step2", "name": "ขั้นตอนที่ 2: ขั้นกระตุ้นความรู้เดิม", "description": "เชื่อมโยงความรู้เดิมกับเนื้อหาใหม่", "max_score": 5},
    {"id": "step3", "name": "ขั้นตอนที่ 3: ขั้นสอนเนื้อหาใหม่", "description": "การอธิบาย สาธิต ยกตัวอย่าง ถาม-ตอบ", "max_score": 5},
    {"id": "step4", "name": "ขั้นตอนที่ 4: ขั้นฝึกปฏิบัติ", "description": "นักเรียนลงมือทำ กิจกรรมกลุ่ม การทำงานร่วมกัน", "max_score": 5},
    {"id": "step5", "name": "ขั้นตอนที่ 5: ขั้นสรุปและประเมิน", "description": "ทบทวน สรุป ประเมินผลการเรียนรู้", "max_score": 5},
    {"id": "cls_mgmt", "name": "การจัดการชั้นเรียน", "description": "ความเป็นระเบียบ การจัดที่นั่ง การใช้สื่อ การบริหารเวลา", "max_score": 5},
    {"id": "active_learn", "name": "การจัดการเรียนรู้เชิงรุก", "description": "นักเรียนมีส่วนร่วม คิดวิเคราะห์ แก้ปัญหา ไม่ใช่แค่ฟัง", "max_score": 5},
    {"id": "assess", "name": "การประเมินผลระหว่างเรียน", "description": "สังเกต ถาม ให้feedback ตรวจสอบความเข้าใจ", "max_score": 5}
  ]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.observation_rubrics WHERE name = 'OBEC 5 ขั้นตอนการจัดการเรียนรู้');

-- Recreate view now that tables exist
DROP VIEW IF EXISTS public.teacher_observation_summary;
CREATE OR REPLACE VIEW public.teacher_observation_summary AS
SELECT
  s.teacher_id,
  COUNT(DISTINCT s.id) AS session_count,
  COUNT(r.id) AS record_count,
  ROUND(AVG(r.total_score)::numeric, 2) AS avg_score,
  ROUND(AVG(CASE WHEN r.max_score > 0 THEN (r.total_score / r.max_score * 100) ELSE NULL END)::numeric, 1) AS avg_percent,
  MAX(r.observed_at) AS last_observed_at
FROM public.observation_sessions s
LEFT JOIN public.observation_records r ON r.session_id = s.id AND r.status = 'submitted'
WHERE s.status = 'completed'
GROUP BY s.teacher_id;

CREATE OR REPLACE FUNCTION public.get_teacher_observation_score(_teacher_id uuid)
RETURNS TABLE(avg_percent numeric, session_count bigint, last_observed_at timestamptz) AS $$
  SELECT avg_percent, session_count, last_observed_at
  FROM public.teacher_observation_summary
  WHERE teacher_id = _teacher_id;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

GRANT SELECT ON public.teacher_observation_summary TO authenticated;
