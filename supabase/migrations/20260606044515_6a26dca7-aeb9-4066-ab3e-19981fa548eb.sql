-- Link inbox items back to source notifications and keep read state in sync

DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.inbox_items
  ADD COLUMN IF NOT EXISTS notification_id uuid REFERENCES public.notifications(id) ON DELETE CASCADE';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $idxguard$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_inbox_items_notification_id ON public.inbox_items(notification_id)';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
-- Update sync trigger to populate notification_id
DROP FUNCTION IF EXISTS public.sync_notification_to_inbox() CASCADE;
CREATE OR REPLACE FUNCTION public.sync_notification_to_inbox()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.inbox_items (user_id, title, message, item_type, category, reference_table, reference_id, priority, notification_id)
  VALUES (
    NEW.user_id,
    NEW.title,
    NEW.message,
    'notification',
    NEW.type,
    NEW.reference_type,
    NEW.reference_id,
    CASE WHEN NEW.type = 'emergency' THEN 'urgent'
         WHEN NEW.type IN ('leave','behavior') THEN 'high'
         ELSE 'normal' END,
    NEW.id
  );
  RETURN NEW;
END $function$;
-- Propagate read state notification -> inbox
DROP FUNCTION IF EXISTS public.propagate_notification_read_to_inbox() CASCADE;
CREATE OR REPLACE FUNCTION public.propagate_notification_read_to_inbox()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_read IS DISTINCT FROM OLD.is_read THEN
    UPDATE public.inbox_items
    SET is_read = NEW.is_read
    WHERE notification_id = NEW.id
      AND is_read IS DISTINCT FROM NEW.is_read;
  END IF;
  RETURN NEW;
END $$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_propagate_notification_read ON public.notifications';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_propagate_notification_read
AFTER UPDATE OF is_read ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.propagate_notification_read_to_inbox()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- Propagate read state inbox -> notification
DROP FUNCTION IF EXISTS public.propagate_inbox_read_to_notification() CASCADE;
CREATE OR REPLACE FUNCTION public.propagate_inbox_read_to_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_read IS DISTINCT FROM OLD.is_read AND NEW.notification_id IS NOT NULL THEN
    UPDATE public.notifications
    SET is_read = NEW.is_read
    WHERE id = NEW.notification_id
      AND is_read IS DISTINCT FROM NEW.is_read;
  END IF;
  RETURN NEW;
END $$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_propagate_inbox_read ON public.inbox_items';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_propagate_inbox_read
AFTER UPDATE OF is_read ON public.inbox_items
FOR EACH ROW EXECUTE FUNCTION public.propagate_inbox_read_to_notification()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
