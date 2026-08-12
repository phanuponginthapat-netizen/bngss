ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS push_sent boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.notification_deep_link(_type text, _reference_type text, _reference_id uuid)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $fn$
  SELECT CASE
    WHEN _type ILIKE 'face_scan%'   THEN '/dashboard/attendance/face-scan-report'
    WHEN _type ILIKE '%attendance%' THEN '/dashboard/attendance'
    WHEN _type ILIKE '%behavior%'   THEN '/dashboard/student/behavior'
    WHEN _type ILIKE '%homework%'   THEN '/dashboard/homework'
    WHEN _type ILIKE '%eform%'      THEN '/dashboard/eforms'
    WHEN _type ILIKE '%document%'   THEN '/dashboard/documents'
    WHEN _type ILIKE '%leave%'      THEN '/dashboard/leaves'
    WHEN _type ILIKE '%news%'       THEN '/dashboard/news'
    WHEN _type ILIKE '%score%' OR _type ILIKE '%grade%' THEN '/dashboard/academic/scores'
    WHEN _type ILIKE '%ict%' OR _type ILIKE '%loan%'    THEN '/dashboard/ict/loans'
    WHEN _type ILIKE '%garbage%'    THEN '/dashboard/garbage'
    WHEN _type ILIKE '%emergency%'  THEN '/dashboard/emergency'
    ELSE '/dashboard/notifications'
  END;
$fn$;

CREATE OR REPLACE FUNCTION public.trigger_push_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE supabase_url text; service_key text;
BEGIN
  IF COALESCE(NEW.push_sent, false) THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.push_subscriptions WHERE user_id = NEW.user_id) THEN RETURN NEW; END IF;
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_key  := current_setting('app.settings.service_role_key', true);
  IF supabase_url IS NULL OR service_key IS NULL THEN RETURN NEW; END IF;
  BEGIN
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/send-push',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||service_key),
      body := jsonb_build_object(
        'user_id', NEW.user_id,
        'title', NEW.title,
        'body', COALESCE(NEW.message,''),
        'url', public.notification_deep_link(NEW.type, NEW.reference_type, NEW.reference_id),
        'tag', COALESCE(NEW.type,'notification'))
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN NEW;
END; $fn$;

CREATE OR REPLACE FUNCTION public.notify_on_face_scan()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  student_name text; s_code text; s_auth uuid; p_uid1 uuid; p_uid2 uuid;
  cls_id uuid; homeroom_name text; homeroom_uid uuid; scan_label text; msg_body text; target uuid;
BEGIN
  SELECT CONCAT(prefix, first_name, ' ', last_name), classroom_id, student_code, auth_user_id, parent_user_id, parent_user_id_2
    INTO student_name, cls_id, s_code, s_auth, p_uid1, p_uid2
    FROM public.students WHERE id = NEW.student_id;

  scan_label := CASE NEW.scan_type
    WHEN 'entry' THEN '🚪 เข้าโรงเรียน'
    WHEN 'exit' THEN '🏃 ออกจากโรงเรียน'
    WHEN 'assembly' THEN '🇹🇭 เช็คชื่อหน้าเสาธง'
    ELSE '📷 สแกนหน้า' END;
  msg_body := COALESCE(student_name,'')||' เวลา '||to_char(NEW.scan_time AT TIME ZONE 'Asia/Bangkok','HH24:MI');

  IF cls_id IS NOT NULL THEN
    SELECT homeroom_teacher INTO homeroom_name FROM public.classrooms WHERE id = cls_id;
    IF homeroom_name IS NOT NULL THEN
      SELECT user_id INTO homeroom_uid FROM public.personnel
        WHERE CONCAT(prefix, first_name, ' ', last_name) = homeroom_name
           OR CONCAT(first_name, ' ', last_name) = homeroom_name LIMIT 1;
    END IF;
  END IF;

  FOR target IN
    SELECT DISTINCT uid FROM (
      SELECT s_auth AS uid
      UNION SELECT p_uid1
      UNION SELECT p_uid2
      UNION SELECT homeroom_uid
      UNION SELECT p.id FROM public.profiles p WHERE s_code IS NOT NULL AND p.student_code = s_code
    ) t WHERE uid IS NOT NULL
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, reference_type, reference_id)
    VALUES (target, scan_label, msg_body, 'face_scan', 'face_scan_log', NEW.id);
  END LOOP;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END; $fn$;
CREATE OR REPLACE FUNCTION public.trigger_push_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF COALESCE(NEW.push_sent, false) THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.push_subscriptions WHERE user_id = NEW.user_id) THEN RETURN NEW; END IF;
  PERFORM public.edge_call('send-push', jsonb_build_object(
    'user_id', NEW.user_id,
    'title', NEW.title,
    'body', COALESCE(NEW.message,''),
    'url', public.notification_deep_link(NEW.type, NEW.reference_type, NEW.reference_id),
    'tag', COALESCE(NEW.type,'notification')));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END; $fn$;

CREATE OR REPLACE FUNCTION public.notify_google_chat(
  _notification_type text, _title text, _message text, _department text DEFAULT 'all',
  _severity text DEFAULT 'info', _url text DEFAULT NULL, _fields jsonb DEFAULT '{}'::jsonb,
  _reference_table text DEFAULT NULL, _reference_id uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  PERFORM public.edge_call('notify-google-chat', jsonb_build_object(
    'notification_type', _notification_type,
    'department', COALESCE(_department,'all'),
    'title', _title,
    'message', _message,
    'severity', COALESCE(_severity,'info'),
    'url', _url,
    'fields', COALESCE(_fields,'{}'::jsonb),
    'reference_table', _reference_table,
    'reference_id', _reference_id));
EXCEPTION WHEN OTHERS THEN NULL;
END; $fn$;
DO $do$
DECLARE base text := 'https://gwmszzoqqxmejefhayqf.supabase.co';
        anonk text := 'sb_publishable_NlRn4zzOUtHsn4swyH6F7Q_ADVmUe9v';
        j record;
BEGIN
  FOR j IN SELECT * FROM (VALUES
    ('notify-retry-15min',            '*/15 * * * *', 'notify-retry',            '{}'),
    ('notify-ict-overdue-daily',      '0 1 * * *',    'notify-ict-overdue',      '{"source":"cron"}'),
    ('notify-calendar-digest-daily',  '30 23 * * *',  'notify-calendar-digest',  '{"source":"cron"}'),
    ('daily-line-digest-morning',     '30 23 * * *',  'daily-line-digest',       '{"source":"cron"}')
  ) AS t(jobname, sched, fn, body)
  LOOP
    PERFORM cron.unschedule(j.jobname) WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = j.jobname);
    PERFORM cron.schedule(j.jobname, j.sched, format(
      $q$SELECT net.http_post(url:='%s/functions/v1/%s', headers:=jsonb_build_object('Content-Type','application/json','apikey','%s','x-cron-secret',COALESCE((SELECT value FROM public.app_secrets WHERE key='CRON_SECRET' LIMIT 1),'')), body:='%s'::jsonb);$q$,
      base, j.fn, anonk, j.body));
  END LOOP;
END $do$;
