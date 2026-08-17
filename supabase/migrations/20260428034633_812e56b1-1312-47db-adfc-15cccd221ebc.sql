-- 1) Promote admin@school.com to super_admin
UPDATE public.user_roles
SET role = 'super_admin'::app_role
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'admin@school.com');

-- 2) E-Forms tables
CREATE TABLE IF NOT EXISTS public.eforms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  sender_id UUID NOT NULL,
  sender_name TEXT,
  template_id TEXT,
  category TEXT,
  title TEXT NOT NULL,
  content_html TEXT NOT NULL,
  form_data JSONB DEFAULT '{}'::jsonb,
  urgency TEXT DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'sent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.eform_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eform_id UUID NOT NULL REFERENCES public.eforms(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL,
  recipient_name TEXT,
  recipient_role TEXT,
  read_at TIMESTAMPTZ,
  reply_text TEXT,
  replied_at TIMESTAMPTZ,
  signature_text TEXT,
  signed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (eform_id, recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_eforms_school ON public.eforms(school_id);
CREATE INDEX IF NOT EXISTS idx_eforms_sender ON public.eforms(sender_id);
CREATE INDEX IF NOT EXISTS idx_eform_recipients_user ON public.eform_recipients(recipient_id);
CREATE INDEX IF NOT EXISTS idx_eform_recipients_form ON public.eform_recipients(eform_id);

-- Auto-fill school_id + updated_at
DROP TRIGGER IF EXISTS eforms_auto_school_id ON public.eforms;
CREATE TRIGGER eforms_auto_school_id
BEFORE INSERT ON public.eforms
FOR EACH ROW EXECUTE FUNCTION public.auto_fill_school_id();

DROP TRIGGER IF EXISTS eforms_set_updated_at ON public.eforms;
CREATE TRIGGER eforms_set_updated_at
BEFORE UPDATE ON public.eforms
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.eforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eform_recipients ENABLE ROW LEVEL SECURITY;

-- eforms: sender, recipients, school admins/director, super/area admin can read
DROP POLICY IF EXISTS "Sender can manage own eforms" ON public.eforms;
CREATE POLICY "Sender can manage own eforms"
ON public.eforms FOR ALL TO authenticated
USING (sender_id = auth.uid())
WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS "Recipients can view eforms sent to them" ON public.eforms;
CREATE POLICY "Recipients can view eforms sent to them"
ON public.eforms FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.eform_recipients r
  WHERE r.eform_id = eforms.id AND r.recipient_id = auth.uid()
));

DROP POLICY IF EXISTS "School admin/director can view school eforms" ON public.eforms;
CREATE POLICY "School admin/director can view school eforms"
ON public.eforms FOR SELECT TO authenticated
USING (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role))
  AND (school_id IS NULL OR school_id = get_user_school_id(auth.uid()))
);

DROP POLICY IF EXISTS "Super/area admin can view all eforms" ON public.eforms;
CREATE POLICY "Super/area admin can view all eforms"
ON public.eforms FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()) OR is_area_admin(auth.uid()));

-- eform_recipients: recipient sees/updates own row; sender + school admin can view
DROP POLICY IF EXISTS "Recipient can view own row" ON public.eform_recipients;
CREATE POLICY "Recipient can view own row"
ON public.eform_recipients FOR SELECT TO authenticated
USING (recipient_id = auth.uid());

DROP POLICY IF EXISTS "Recipient can update own row" ON public.eform_recipients;
CREATE POLICY "Recipient can update own row"
ON public.eform_recipients FOR UPDATE TO authenticated
USING (recipient_id = auth.uid())
WITH CHECK (recipient_id = auth.uid());

DROP POLICY IF EXISTS "Sender can manage recipients" ON public.eform_recipients;
CREATE POLICY "Sender can manage recipients"
ON public.eform_recipients FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.eforms e WHERE e.id = eform_recipients.eform_id AND e.sender_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.eforms e WHERE e.id = eform_recipients.eform_id AND e.sender_id = auth.uid()));

DROP POLICY IF EXISTS "School admin/director can view recipients" ON public.eform_recipients;
CREATE POLICY "School admin/director can view recipients"
ON public.eform_recipients FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role)
  OR is_super_admin(auth.uid()) OR is_area_admin(auth.uid())
);

-- Notify recipients when an eform is sent to them
CREATE OR REPLACE FUNCTION public.notify_on_eform_recipient()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  eform_title TEXT;
  sender TEXT;
BEGIN
  SELECT title, COALESCE(sender_name,'') INTO eform_title, sender
  FROM public.eforms WHERE id = NEW.eform_id;

  INSERT INTO public.notifications (user_id, title, message, type, reference_type, reference_id)
  VALUES (
    NEW.recipient_id,
    '📄 เอกสารใหม่: ' || COALESCE(eform_title,'(ไม่มีชื่อ)'),
    'จาก ' || COALESCE(sender,'ระบบ') || ' — กดเพื่อเปิดอ่านและตอบกลับ',
    'eform',
    'eform',
    NEW.eform_id
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS eform_recipients_notify ON public.eform_recipients;
CREATE TRIGGER eform_recipients_notify
AFTER INSERT ON public.eform_recipients
FOR EACH ROW EXECUTE FUNCTION public.notify_on_eform_recipient();