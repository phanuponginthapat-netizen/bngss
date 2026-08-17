
CREATE TABLE IF NOT EXISTS public.role_notification_defaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,
  category text NOT NULL,
  in_app boolean NOT NULL DEFAULT true,
  push boolean NOT NULL DEFAULT true,
  line boolean NOT NULL DEFAULT false,
  gchat boolean NOT NULL DEFAULT false,
  min_severity text NOT NULL DEFAULT 'info',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE (role, category)
);

GRANT SELECT ON public.role_notification_defaults TO authenticated, anon;
GRANT ALL ON public.role_notification_defaults TO service_role;

ALTER TABLE public.role_notification_defaults ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone can read matrix" ON public.role_notification_defaults;
DROP POLICY IF EXISTS "anyone can read matrix" ON public.role_notification_defaults;
CREATE POLICY "anyone can read matrix"
  ON public.role_notification_defaults FOR SELECT USING (true);

DROP POLICY IF EXISTS "admin/director can manage matrix" ON public.role_notification_defaults;
DROP POLICY IF EXISTS "admin/director can manage matrix" ON public.role_notification_defaults;
CREATE POLICY "admin/director can manage matrix"
  ON public.role_notification_defaults FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

INSERT INTO public.role_notification_defaults (role, category, in_app, push, line, gchat, min_severity) VALUES
  ('admin','critical',   true, true, true, true, 'info'),
  ('admin','score',      true, true, false, true, 'info'),
  ('admin','health',     true, true, false, true, 'info'),
  ('admin','ict',        true, true, false, true, 'info'),
  ('admin','attendance', true, true, false, true, 'info'),
  ('admin','behavior',   true, true, false, true, 'info'),
  ('admin','homework',   true, true, false, false,'info'),
  ('admin','eform',      true, true, true, true, 'info'),
  ('admin','leave',      true, true, true, true, 'info'),
  ('admin','news',       true, true, false, false,'info'),
  ('admin','other',      true, true, false, false,'info'),
  ('director','critical',   true, true, true, true, 'info'),
  ('director','score',      true, true, false, true, 'warning'),
  ('director','health',     true, true, false, true, 'warning'),
  ('director','ict',        true, true, false, true, 'warning'),
  ('director','attendance', true, true, false, true, 'warning'),
  ('director','behavior',   true, true, false, true, 'warning'),
  ('director','homework',   true, false,false,false,'warning'),
  ('director','eform',      true, true, true, true, 'info'),
  ('director','leave',      true, true, true, true, 'info'),
  ('director','news',       true, true, false, false,'info'),
  ('director','other',      true, false,false,false,'warning'),
  ('teacher','critical',   true, true, true, false,'info'),
  ('teacher','score',      true, false,false,false,'info'),
  ('teacher','health',     true, true, false,false,'warning'),
  ('teacher','ict',        true, true, false,false,'info'),
  ('teacher','attendance', true, true, false,false,'info'),
  ('teacher','behavior',   true, true, false,false,'info'),
  ('teacher','homework',   true, true, false,false,'info'),
  ('teacher','eform',      true, true, true, false,'info'),
  ('teacher','leave',      true, true, true, false,'info'),
  ('teacher','news',       true, false,false,false,'info'),
  ('teacher','other',      true, false,false,false,'info'),
  ('student','critical',   true, true, true, false,'info'),
  ('student','score',      true, true, false,false,'info'),
  ('student','health',     true, false,false,false,'warning'),
  ('student','ict',        true, false,false,false,'warning'),
  ('student','attendance', true, true, false,false,'info'),
  ('student','behavior',   true, true, false,false,'info'),
  ('student','homework',   true, true, false,false,'info'),
  ('student','eform',      true, true, true, false,'info'),
  ('student','leave',      true, true, false,false,'info'),
  ('student','news',       true, true, false,false,'info'),
  ('student','other',      true, false,false,false,'info'),
  ('parent','critical',   true, true, true, false,'info'),
  ('parent','score',      true, true, true, false,'info'),
  ('parent','health',     true, true, true, false,'info'),
  ('parent','ict',        true, false,false,false,'warning'),
  ('parent','attendance', true, true, true, false,'info'),
  ('parent','behavior',   true, true, true, false,'info'),
  ('parent','homework',   true, true, false,false,'info'),
  ('parent','eform',      true, true, true, false,'info'),
  ('parent','leave',      true, true, true, false,'info'),
  ('parent','news',       true, true, false,false,'info'),
  ('parent','other',      true, false,false,false,'info'),
  ('alumni','critical',   true, true, false,false,'critical'),
  ('alumni','news',       true, true, false,false,'info'),
  ('alumni','other',      false,false,false,false,'critical')
ON CONFLICT (role, category) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications(user_id, created_at DESC) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ndl_dedup_lookup
  ON public.notification_delivery_log(notification_type, reason, created_at DESC)
  WHERE reason LIKE 'dedup:%';
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student_date
  ON public.attendance(student_id, attendance_date DESC);
CREATE INDEX IF NOT EXISTS idx_face_scan_logs_created
  ON public.face_scan_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_behavior_records_student_created
  ON public.behavior_records(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conv_created
  ON public.chat_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id, role);
CREATE INDEX IF NOT EXISTS idx_eform_recipients_status
  ON public.eform_recipients(recipient_id, status);
CREATE INDEX IF NOT EXISTS idx_task_assignments_user
  ON public.task_assignments(assigned_to_user_id, status);
