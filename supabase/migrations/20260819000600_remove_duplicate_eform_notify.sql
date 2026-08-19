-- Remove the legacy DB trigger that creates a duplicate in-app notification.
-- The client (SendEFormDialog) already fans out in_app + push + LINE via notify(),
-- so the trigger produces a duplicate in-app notification per recipient.
DROP TRIGGER IF EXISTS eform_recipients_notify ON public.eform_recipients;
DROP FUNCTION IF EXISTS public.notify_on_eform_recipient() CASCADE;