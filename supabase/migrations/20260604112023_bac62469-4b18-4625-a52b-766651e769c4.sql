-- Harden notification triggers: never block inserts, skip when no subscription/recipient exists.

DROP FUNCTION IF EXISTS public.notify_line_on_notification() CASCADE;
CREATE OR REPLACE FUNCTION public.notify_line_on_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  line_enabled TEXT;
  supabase_url TEXT;
  service_key TEXT;
  has_line BOOLEAN;
BEGIN
  -- Skip silently if target user has no linked LINE id
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = NEW.user_id AND line_user_id IS NOT NULL
  ) INTO has_line;
  IF NOT has_line THEN
    RETURN NEW;
  END IF;

  SELECT setting_value INTO line_enabled
  FROM public.school_settings
  WHERE setting_key = 'line_notify_enabled'
  LIMIT 1;
  IF line_enabled IS DISTINCT FROM 'true' THEN
    RETURN NEW;
  END IF;

  supabase_url := current_setting('app.settings.supabase_url', true);
  service_key  := current_setting('app.settings.service_role_key', true);
  IF supabase_url IS NULL OR service_key IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
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
  EXCEPTION WHEN OTHERS THEN
    -- swallow: notifications must not fail because of LINE delivery
    NULL;
  END;
  RETURN NEW;
END;
$function$;
DROP FUNCTION IF EXISTS public.trigger_push_notification() CASCADE;
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
BEGIN
  -- Skip if user has no push subscription registered
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

  BEGIN
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
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$function$;
