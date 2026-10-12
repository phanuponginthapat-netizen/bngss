-- แจ้งเตือนหยุดส่งถึงเครื่องตั้งแต่ 7 ส.ค. 2026: trigger เรียก extensions.http_post ซึ่งไม่ได้ติดตั้ง
-- (error ถูกกลืนเงียบ) — เปลี่ยนมาใช้ pg_net ที่มีอยู่แล้ว
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.trigger_push_notification()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  supabase_url TEXT; service_key TEXT; target_url TEXT;
BEGIN
  IF NEW.push_sent THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.push_subscriptions WHERE user_id = NEW.user_id) THEN RETURN NEW; END IF;
  SELECT value INTO supabase_url FROM public.system_credentials WHERE key = 'supabase_url';
  SELECT value INTO service_key  FROM public.system_credentials WHERE key = 'service_role_key';
  IF coalesce(supabase_url,'') = '' OR coalesce(service_key,'') = '' THEN RETURN NEW; END IF;
  target_url := CASE
    WHEN NEW.reference_type = 'homework' THEN '/dashboard/homework'
    WHEN NEW.reference_type = 'eform'    THEN '/dashboard/eform/inbox'
    WHEN NEW.reference_type = 'leave'    THEN '/dashboard/leave'
    WHEN NEW.reference_type = 'news'     THEN '/dashboard/feed'
    WHEN NEW.reference_type = 'behavior' THEN '/dashboard/behavior'
    WHEN NEW.reference_type = 'attendance' THEN '/dashboard/attendance'
    ELSE '/dashboard' END;
  BEGIN
    PERFORM net.http_post(
      url := rtrim(supabase_url,'/') || '/functions/v1/send-push',
      body := jsonb_build_object('user_id', NEW.user_id, 'title', NEW.title,
        'body', COALESCE(NEW.message,''), 'url', target_url, 'tag', COALESCE(NEW.type,'notification')),
      headers := jsonb_build_object('Content-Type','application/json',
        'Authorization','Bearer ' || service_key, 'apikey', service_key),
      timeout_milliseconds := 10000);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'push enqueue failed: %', SQLERRM;
  END;
  RETURN NEW;
END;
$function$;

-- svc_url()/svc_key() เดิมเรียกตัวเองซ้ำไม่รู้จบเมื่อไม่มีค่า — แก้ให้คืน NULL แทน
CREATE OR REPLACE FUNCTION public.svc_url() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT value FROM public.system_credentials WHERE key='supabase_url' $$;
CREATE OR REPLACE FUNCTION public.svc_key() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT value FROM public.system_credentials WHERE key='service_role_key' $$;

-- ตรวจผล: ควรได้ true
SELECT pg_get_functiondef('public.trigger_push_notification'::regproc) LIKE '%net.http_post%' AS "แก้ส่งแจ้งเตือนแล้ว";
