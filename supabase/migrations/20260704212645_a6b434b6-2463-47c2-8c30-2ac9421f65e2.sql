-- Prevent duplicate Web Push: fanout marks push_sent=true so the DB trigger doesn't fire a second time
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS push_sent boolean NOT NULL DEFAULT false';
    EXIT;
    EXCEPTION
      WHEN deadlock_detected OR lock_not_available THEN
        _ddl_try := _ddl_try + 1;
        IF _ddl_try >= 10 THEN
          RAISE NOTICE 'giving up after lock contention: %', SQLERRM;
          EXIT;
        END IF;
        PERFORM pg_sleep(0.4 * _ddl_try);
      WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
        RAISE NOTICE 'skipped: %', SQLERRM;
        EXIT;
    END;
  END LOOP;
END
$guard$;
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
