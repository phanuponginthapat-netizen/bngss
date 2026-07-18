
-- Prevent duplicate Web Push: fanout marks push_sent=true so the DB trigger doesn't fire a second time
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS push_sent boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.trigger_push_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  supabase_url TEXT;
  service_key TEXT;
  has_sub BOOLEAN;
  target_url TEXT;
BEGIN
  -- Skip if the caller (notify-fanout) already sent a richer push
  IF NEW.push_sent THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.push_subscriptions WHERE user_id = NEW.user_id
  ) INTO has_sub;
  IF NOT has_sub THEN
    RETURN NEW;
  END IF;

  supabase_url := current_setting('app.settings.supabase_url', true);
  service_key  := current_setting('app.settings.service_role_key', true);
  IF supabase_url IS NULL OR service_key IS NULL THEN
    RETURN NEW;
  END IF;

  -- Best-effort deep-link based on reference_type
  target_url := CASE
    WHEN NEW.reference_type = 'homework' THEN '/dashboard/homework'
    WHEN NEW.reference_type = 'eform'    THEN '/dashboard/eform/inbox'
    WHEN NEW.reference_type = 'leave'    THEN '/dashboard/leave'
    WHEN NEW.reference_type = 'news'     THEN '/dashboard/feed'
    WHEN NEW.reference_type = 'behavior' THEN '/dashboard/behavior'
    WHEN NEW.reference_type = 'attendance' THEN '/dashboard/attendance'
    ELSE '/dashboard'
  END;

  BEGIN
    PERFORM extensions.http_post(
      url := supabase_url || '/functions/v1/send-push',
      body := json_build_object(
        'user_id', NEW.user_id,
        'title', NEW.title,
        'body', COALESCE(NEW.message, ''),
        'url', target_url,
        'tag', COALESCE(NEW.type, 'notification')
      )::text,
      headers := json_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      )::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$function$;
