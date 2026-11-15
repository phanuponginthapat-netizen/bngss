CREATE OR REPLACE FUNCTION public.trigger_push_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.push_sent THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.push_subscriptions WHERE user_id = NEW.user_id) THEN RETURN NEW; END IF;
  PERFORM public.cron_invoke('send-push', jsonb_build_object(
    'user_id', NEW.user_id,
    'title', NEW.title,
    'body', COALESCE(NEW.message, ''),
    'url', '/dashboard/inbox',
    'tag', 'notifications-' || NEW.id::text), 15000);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'trigger_push_notification failed safely: %', SQLSTATE;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.send_line_to_student_parents(_student_id uuid, _title text, _message text, _image_url text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  ids text[];
  auto_push_enabled text;
  img text;
BEGIN
  SELECT setting_value INTO auto_push_enabled
    FROM public.school_settings WHERE setting_key = 'line_auto_push_enabled' LIMIT 1;
  IF auto_push_enabled IS DISTINCT FROM 'true' THEN RETURN; END IF;

  SELECT ARRAY(SELECT x FROM unnest(ARRAY[line_user_id, line_user_id_2, line_user_id_3]) x WHERE x IS NOT NULL AND x <> '')
    INTO ids FROM public.students WHERE id = _student_id;
  IF ids IS NULL OR array_length(ids,1) IS NULL THEN RETURN; END IF;

  IF _image_url IS NOT NULL AND _image_url LIKE 'https://%' THEN img := _image_url; ELSE img := NULL; END IF;

  PERFORM public.cron_invoke('notify-line', jsonb_build_object(
    'message', COALESCE(_title,'') || E'\n' || COALESCE(_message,''),
    'title', _title,
    'line_user_ids', to_jsonb(ids),
    'image_url', img,
    'use_flex', true,
    'severity', 'info'), 15000);
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'send_line_to_student_parents failed safely: %', SQLSTATE;
END $function$;