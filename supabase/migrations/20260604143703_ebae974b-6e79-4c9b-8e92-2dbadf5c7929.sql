-- AI Chat Logs: เก็บประวัติการสนทนา AI ต่อ user เพื่อวิเคราะห์ความเสี่ยง
CREATE TABLE IF NOT EXISTS public.ai_chat_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  -- analysis fields (filled for user messages)
  topic TEXT,            -- 'academic','homework','health','social','personal','system','other'
  sentiment TEXT,        -- 'positive','neutral','negative'
  risk_level TEXT,       -- 'none','low','medium','high'
  risk_flags TEXT[],     -- ['self_harm','violence','bullying','drugs','sexual','depression']
  tokens_in INT,
  tokens_out INT,
  model TEXT,
  user_role TEXT,        -- snapshot ของ role ขณะแชต
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_logs_user ON public.ai_chat_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_chat_logs_risk ON public.ai_chat_logs(risk_level, created_at DESC)
  WHERE risk_level IN ('medium','high');
CREATE INDEX IF NOT EXISTS idx_ai_chat_logs_topic ON public.ai_chat_logs(topic, created_at DESC);

GRANT SELECT, INSERT ON public.ai_chat_logs TO authenticated;
GRANT ALL ON public.ai_chat_logs TO service_role;

ALTER TABLE public.ai_chat_logs ENABLE ROW LEVEL SECURITY;

-- ผู้ใช้ดูประวัติของตัวเองได้
DROP POLICY IF EXISTS "Users can view their own chat logs" ON public.ai_chat_logs;
CREATE POLICY "Users can view their own chat logs"
ON public.ai_chat_logs FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- admin / director ดูได้ทั้งหมด เพื่อวิเคราะห์ความเสี่ยง
DROP POLICY IF EXISTS "Admins and directors can view all chat logs" ON public.ai_chat_logs;
CREATE POLICY "Admins and directors can view all chat logs"
ON public.ai_chat_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));

-- ครูที่เป็น homeroom ดู log ของนักเรียนในห้องตัวเองได้
DROP POLICY IF EXISTS "Homeroom teachers can view their students' chat logs" ON public.ai_chat_logs;
CREATE POLICY "Homeroom teachers can view their students' chat logs"
ON public.ai_chat_logs FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.students s
    JOIN public.classrooms c ON c.id = s.classroom_id
    WHERE s.auth_user_id = ai_chat_logs.user_id
      AND (c.homeroom_teacher_id IN (SELECT id FROM public.personnel WHERE user_id = auth.uid())
        OR c.homeroom_teacher_2_id IN (SELECT id FROM public.personnel WHERE user_id = auth.uid()))
  )
);

-- เปิด realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_chat_logs;

-- View สรุปการใช้งานรายผู้ใช้ (สำหรับ analytics)
CREATE OR REPLACE VIEW public.ai_usage_summary AS
SELECT
  l.user_id,
  COUNT(*) FILTER (WHERE l.role='user') AS messages_sent,
  COUNT(*) FILTER (WHERE l.role='user' AND l.risk_level IN ('medium','high')) AS risky_messages,
  COUNT(*) FILTER (WHERE l.role='user' AND l.sentiment='negative') AS negative_messages,
  COUNT(*) FILTER (WHERE l.role='user' AND l.sentiment='positive') AS positive_messages,
  MAX(l.created_at) AS last_used_at,
  COUNT(DISTINCT date_trunc('day', l.created_at)) AS active_days,
  mode() WITHIN GROUP (ORDER BY l.topic) FILTER (WHERE l.role='user') AS top_topic
FROM public.ai_chat_logs l
GROUP BY l.user_id;

GRANT SELECT ON public.ai_usage_summary TO authenticated;