-- Recipient: add reject fields
ALTER TABLE public.eform_recipients
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reject_reason TEXT;

-- Attachments table
CREATE TABLE IF NOT EXISTS public.eform_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eform_id UUID NOT NULL REFERENCES public.eforms(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_eform_attachments_form ON public.eform_attachments(eform_id);

ALTER TABLE public.eform_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View attachments of accessible eforms" ON public.eform_attachments;
CREATE POLICY "View attachments of accessible eforms"
ON public.eform_attachments FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.eforms e
  WHERE e.id = eform_attachments.eform_id
    AND (
      e.sender_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.eform_recipients r WHERE r.eform_id = e.id AND r.recipient_id = auth.uid())
      OR is_super_admin(auth.uid()) OR is_area_admin(auth.uid())
      OR (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'director'::app_role))
    )
));

DROP POLICY IF EXISTS "Sender can manage attachments" ON public.eform_attachments;
CREATE POLICY "Sender can manage attachments"
ON public.eform_attachments FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.eforms e WHERE e.id = eform_attachments.eform_id AND e.sender_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.eforms e WHERE e.id = eform_attachments.eform_id AND e.sender_id = auth.uid()));

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('eform-attachments', 'eform-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: path = <eform_id>/<filename>
DROP POLICY IF EXISTS "eform attach: sender can upload" ON storage.objects;
CREATE POLICY "eform attach: sender can upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'eform-attachments'
  AND EXISTS (
    SELECT 1 FROM public.eforms e
    WHERE e.id::text = (storage.foldername(name))[1]
      AND e.sender_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "eform attach: sender can delete" ON storage.objects;
CREATE POLICY "eform attach: sender can delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'eform-attachments'
  AND EXISTS (
    SELECT 1 FROM public.eforms e
    WHERE e.id::text = (storage.foldername(name))[1]
      AND e.sender_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "eform attach: sender/recipients can read" ON storage.objects;
CREATE POLICY "eform attach: sender/recipients can read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'eform-attachments'
  AND EXISTS (
    SELECT 1 FROM public.eforms e
    WHERE e.id::text = (storage.foldername(name))[1]
      AND (
        e.sender_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.eform_recipients r WHERE r.eform_id = e.id AND r.recipient_id = auth.uid())
        OR is_super_admin(auth.uid()) OR is_area_admin(auth.uid())
      )
  )
);

-- Auto-update parent eform.status from recipient activity
CREATE OR REPLACE FUNCTION public.recompute_eform_status()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  total INT;
  signed INT;
  rejected INT;
  current_status TEXT;
  new_status TEXT;
BEGIN
  SELECT status INTO current_status FROM public.eforms WHERE id = NEW.eform_id;
  IF current_status = 'draft' THEN RETURN NEW; END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE signed_at IS NOT NULL),
    COUNT(*) FILTER (WHERE rejected_at IS NOT NULL)
  INTO total, signed, rejected
  FROM public.eform_recipients
  WHERE eform_id = NEW.eform_id;

  IF rejected > 0 THEN new_status := 'rejected';
  ELSIF total > 0 AND signed = total THEN new_status := 'completed';
  ELSIF signed > 0 THEN new_status := 'pending_signature';
  ELSE new_status := 'sent';
  END IF;

  UPDATE public.eforms SET status = new_status, updated_at = now() WHERE id = NEW.eform_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS eform_recipients_recompute ON public.eform_recipients;
CREATE TRIGGER eform_recipients_recompute
AFTER INSERT OR UPDATE ON public.eform_recipients
FOR EACH ROW EXECUTE FUNCTION public.recompute_eform_status();

-- Notify sender on recipient action
CREATE OR REPLACE FUNCTION public.notify_sender_on_recipient_action()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  sender UUID;
  eform_title TEXT;
  msg TEXT;
  evt TEXT;
BEGIN
  IF NEW.signed_at IS NOT NULL AND (OLD.signed_at IS NULL) THEN evt := 'signed';
  ELSIF NEW.rejected_at IS NOT NULL AND (OLD.rejected_at IS NULL) THEN evt := 'rejected';
  ELSIF NEW.replied_at IS NOT NULL AND (OLD.replied_at IS NULL) THEN evt := 'replied';
  ELSE RETURN NEW;
  END IF;

  SELECT sender_id, title INTO sender, eform_title FROM public.eforms WHERE id = NEW.eform_id;
  IF sender IS NULL THEN RETURN NEW; END IF;

  msg := CASE evt
    WHEN 'signed' THEN COALESCE(NEW.recipient_name,'ผู้รับ') || ' ลงนามเอกสารแล้ว'
    WHEN 'rejected' THEN COALESCE(NEW.recipient_name,'ผู้รับ') || ' ปฏิเสธเอกสาร: ' || COALESCE(NEW.reject_reason,'-')
    WHEN 'replied' THEN COALESCE(NEW.recipient_name,'ผู้รับ') || ' ตอบกลับเอกสาร'
  END;

  INSERT INTO public.notifications (user_id, title, message, type, reference_type, reference_id)
  VALUES (sender, '📄 ' || COALESCE(eform_title,'เอกสาร'), msg, 'eform', 'eform', NEW.eform_id);

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS eform_recipients_notify_sender ON public.eform_recipients;
CREATE TRIGGER eform_recipients_notify_sender
AFTER UPDATE ON public.eform_recipients
FOR EACH ROW EXECUTE FUNCTION public.notify_sender_on_recipient_action();