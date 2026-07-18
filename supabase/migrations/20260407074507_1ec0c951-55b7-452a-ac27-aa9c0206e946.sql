-- Create extension pg_net if not exists (for HTTP calls from triggers)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create trigger function to send LINE notification
CREATE OR REPLACE FUNCTION public.notify_line_on_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  line_enabled TEXT;
  supabase_url TEXT;
  service_key TEXT;
BEGIN
  -- Check if LINE notifications are enabled
  SELECT setting_value INTO line_enabled
  FROM public.school_settings
  WHERE setting_key = 'line_notify_enabled'
  LIMIT 1;

  IF line_enabled IS DISTINCT FROM 'true' THEN
    RETURN NEW;
  END IF;

  -- Get Supabase URL from env
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_key := current_setting('app.settings.service_role_key', true);

  IF supabase_url IS NULL OR service_key IS NULL THEN
    RETURN NEW;
  END IF;

  -- Call notify-line edge function via pg_net
  PERFORM extensions.http_post(
    url := supabase_url || '/functions/v1/notify-line',
    body := json_build_object(
      'message', COALESCE(NEW.title, '') || CASE WHEN NEW.message IS NOT NULL THEN E'\n' || NEW.message ELSE '' END,
      'title', NEW.title,
      'user_ids', json_build_array(NEW.user_id),
      'use_flex', true,
      'severity', 'info',
      'notification_type', COALESCE(NEW.type, 'general')
    )::text,
    headers := json_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    )::jsonb
  );

  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS on_notification_send_line ON public.notifications;
CREATE TRIGGER on_notification_send_line
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_line_on_notification();