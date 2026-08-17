-- Enable pg_net extension for HTTP calls from database
DO $extguard$
BEGIN
  EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'skip extension: %', SQLERRM;
END
$extguard$;
-- Create function to trigger push notification
DROP FUNCTION IF EXISTS public.trigger_push_notification() CASCADE;
CREATE OR REPLACE FUNCTION public.trigger_push_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  supabase_url TEXT;
  service_key TEXT;
BEGIN
  -- Get the Supabase URL and service role key from vault or env
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_key := current_setting('app.settings.service_role_key', true);

  -- If settings not available, try direct approach
  IF supabase_url IS NULL OR service_key IS NULL THEN
    RETURN NEW;
  END IF;

  -- Call send-push edge function via pg_net
  PERFORM extensions.http_post(
    url := supabase_url || '/functions/v1/send-push',
    body := json_build_object(
      'user_id', NEW.user_id,
      'title', NEW.title,
      'body', COALESCE(NEW.message, ''),
      'url', '/dashboard',
      'tag', COALESCE(NEW.type, 'notification')
    )::text,
    headers := json_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    )::jsonb
  );

  RETURN NEW;
END;
$$;
-- Create trigger on notifications table
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS on_notification_send_push ON public.notifications';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER on_notification_send_push
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.trigger_push_notification()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
