CREATE OR REPLACE FUNCTION public.notify_google_chat(
  _notification_type text,
  _title text,
  _message text,
  _department text DEFAULT 'all',
  _severity text DEFAULT 'info',
  _url text DEFAULT NULL,
  _fields jsonb DEFAULT NULL,
  _reference_table text DEFAULT NULL,
  _reference_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w record;
  v_icon text;
  v_payload jsonb;
  v_text text;
  v_fields_text text := '';
  v_kv record;
  v_log_id uuid;
BEGIN
  v_icon := CASE _severity
    WHEN 'success' THEN '✅'
    WHEN 'warning' THEN '⚠️'
    WHEN 'error'   THEN '🚨'
    WHEN 'critical' THEN '🚨'
    ELSE 'ℹ️'
  END;

  IF _fields IS NOT NULL AND jsonb_typeof(_fields) = 'object' THEN
    FOR v_kv IN SELECT * FROM jsonb_each_text(_fields) LOOP
      v_fields_text := v_fields_text || E'\n• *' || v_kv.key || ':* ' || COALESCE(v_kv.value, '-');
    END LOOP;
  END IF;

  v_text := v_icon || ' *' || COALESCE(_title, '-') || '*' || E'\n' || COALESCE(_message, '')
            || v_fields_text
            || CASE WHEN _url IS NOT NULL THEN E'\n🔗 ' || _url ELSE '' END;

  v_payload := jsonb_build_object('text', v_text);

  FOR w IN
    SELECT id, webhook_url, department
      FROM public.google_chat_webhooks
     WHERE is_active = true
       AND (department = 'all' OR department = COALESCE(_department, 'all'))
       AND (
         notification_types IS NULL
         OR array_length(notification_types, 1) IS NULL
         OR _notification_type = ANY(notification_types)
         OR 'all' = ANY(notification_types)
       )
  LOOP
    INSERT INTO public.google_chat_logs (
      webhook_id, notification_type, department, title, message, payload, status
    ) VALUES (
      w.id, _notification_type, COALESCE(_department,'all'), _title, _message, v_payload, 'pending'
    ) RETURNING id INTO v_log_id;

    BEGIN
      PERFORM net.http_post(
        url := w.webhook_url,
        headers := jsonb_build_object('Content-Type','application/json'),
        body := v_payload
      );
      UPDATE public.google_chat_logs SET status='sent', http_status=200 WHERE id = v_log_id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.google_chat_logs
         SET status='failed', error_text=SQLERRM
       WHERE id = v_log_id;
    END;
  END LOOP;
END;
$$;
-- ทดสอบยิงทันที
SELECT public.notify_google_chat(
  'system',
  'ระบบแจ้งเตือนกลับมาทำงาน',
  'แก้ฟังก์ชัน notify_google_chat ให้ยิงตรงเข้า webhook แล้ว — ก่อนหน้านี้ส่งผ่าน edge function ที่ไม่มี config ทำให้เงียบทุกครั้ง',
  'all',
  'success'
);
