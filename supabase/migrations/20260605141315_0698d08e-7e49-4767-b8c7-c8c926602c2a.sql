CREATE OR REPLACE FUNCTION public.notify_homeroom_on_ai_risk()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  s_id uuid;
  s_name text;
  cls_name text;
  cls_id uuid;
  ht1 uuid;
  ht2 uuid;
  ht_uid uuid;
  flags_text text;
  preview text;
BEGIN
  IF NEW.role <> 'user' THEN RETURN NEW; END IF;
  IF NEW.risk_level NOT IN ('high','medium') THEN RETURN NEW; END IF;
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;

  SELECT s.id, CONCAT(s.prefix, s.first_name, ' ', s.last_name),
         c.id, c.class_name, c.homeroom_teacher_id, c.homeroom_teacher_2_id
    INTO s_id, s_name, cls_id, cls_name, ht1, ht2
    FROM public.students s
    LEFT JOIN public.classrooms c ON c.id = s.classroom_id
    WHERE s.auth_user_id = NEW.user_id
    LIMIT 1;

  IF s_id IS NULL THEN RETURN NEW; END IF;

  flags_text := COALESCE(array_to_string(NEW.risk_flags, ', '), '-');
  preview := LEFT(COALESCE(NEW.content,''), 200);

  -- Notify homeroom teacher #1
  FOR ht_uid IN
    SELECT user_id FROM public.personnel WHERE id IN (ht1, ht2) AND user_id IS NOT NULL
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, reference_type, reference_id)
    VALUES (
      ht_uid,
      '🚨 พบความเสี่ยงจากการใช้ AI: ' || COALESCE(s_name,'นักเรียน'),
      'ห้อง ' || COALESCE(cls_name,'-') || ' • ระดับ ' || NEW.risk_level
        || ' • flags: ' || flags_text || E'\n"' || preview || '"',
      'ai_risk',
      'ai_chat_log',
      NEW.id
    );
  END LOOP;

  -- Google Chat to student_affairs
  PERFORM public.notify_google_chat(
    'ai_risk',
    '🚨 ความเสี่ยงจากการใช้ AI: ' || COALESCE(s_name,'-'),
    'ห้อง ' || COALESCE(cls_name,'-') || ' • ระดับ ' || NEW.risk_level || E'\n"' || preview || '"',
    'student_affairs',
    CASE WHEN NEW.risk_level = 'high' THEN 'critical' ELSE 'warning' END,
    public.app_base_url() || '/admin/ai-analytics',
    jsonb_build_object('flags', flags_text, 'topic', COALESCE(NEW.topic,'-')),
    'ai_chat_logs', NEW.id
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'notify_homeroom_on_ai_risk failed: %', SQLERRM;
  RETURN NEW;
END $$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_notify_homeroom_on_ai_risk ON public.ai_chat_logs';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_notify_homeroom_on_ai_risk
AFTER INSERT ON public.ai_chat_logs
FOR EACH ROW
EXECUTE FUNCTION public.notify_homeroom_on_ai_risk()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
