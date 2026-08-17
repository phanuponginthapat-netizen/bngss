-- เพิ่ม setting ควบคุม LINE auto-push (default = false, ปิดเพื่อประหยัดโควต้า)
INSERT INTO public.school_settings (setting_key, setting_value)
VALUES ('line_auto_push_enabled', 'false')
ON CONFLICT (setting_key) DO NOTHING;
-- แก้ send_line_to_student_parents ให้เคารพ setting นี้
CREATE OR REPLACE FUNCTION public.send_line_to_student_parents(_student_id uuid, _title text, _message text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  ids text[];
  supabase_url text;
  service_key text;
  auto_push_enabled text;
BEGIN
  -- เช็คก่อน: ถ้า admin ปิด LINE auto-push อยู่ ให้ข้ามทั้งหมด
  SELECT setting_value INTO auto_push_enabled
    FROM public.school_settings WHERE setting_key = 'line_auto_push_enabled' LIMIT 1;
  IF auto_push_enabled IS DISTINCT FROM 'true' THEN RETURN; END IF;

  SELECT ARRAY(SELECT x FROM unnest(ARRAY[line_user_id, line_user_id_2, line_user_id_3]) x WHERE x IS NOT NULL AND x <> '')
    INTO ids FROM public.students WHERE id = _student_id;
  IF ids IS NULL OR array_length(ids,1) IS NULL THEN RETURN; END IF;

  supabase_url := current_setting('app.settings.supabase_url', true);
  service_key  := current_setting('app.settings.service_role_key', true);
  IF supabase_url IS NULL OR service_key IS NULL THEN RETURN; END IF;

  BEGIN
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/notify-line',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||service_key),
      body := jsonb_build_object(
        'message', COALESCE(_title,'') || E'\n' || COALESCE(_message,''),
        'title', _title,
        'line_user_ids', to_jsonb(ids),
        'severity', 'info'
      )
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $function$;
-- ปลด cron daily-line-digest (ถ้าเคย schedule ไว้)
DO $$
BEGIN
  PERFORM cron.unschedule('daily-line-digest');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
  PERFORM cron.unschedule('daily_line_digest');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
