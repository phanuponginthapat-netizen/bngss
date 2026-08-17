-- 1) Google Chat delivery logs
CREATE TABLE IF NOT EXISTS public.google_chat_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid,
  notification_type text,
  department text,
  title text,
  message text,
  payload jsonb,
  status text NOT NULL DEFAULT 'pending',
  http_status int,
  error_text text,
  reference_table text,
  reference_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.google_chat_logs ENABLE ROW LEVEL SECURITY';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Admin/Director can view chat logs" ON public.google_chat_logs';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Admin/Director can view chat logs" ON public.google_chat_logs';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Admin/Director can view chat logs"
ON public.google_chat_logs FOR SELECT
USING (public.has_role(auth.uid(),''admin'') OR public.has_role(auth.uid(),''director''))';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Service role can insert chat logs" ON public.google_chat_logs';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Service role can insert chat logs" ON public.google_chat_logs';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Service role can insert chat logs"
ON public.google_chat_logs FOR INSERT
WITH CHECK (true)';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $idxguard$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_gchat_logs_created ON public.google_chat_logs(created_at DESC)';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
DO $idxguard$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_gchat_logs_type ON public.google_chat_logs(notification_type)';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
-- 2) Helper DB function
DROP FUNCTION IF EXISTS public.notify_google_chat(text, text, text, text, text, text, jsonb, text, uuid) CASCADE;
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
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  supabase_url text;
  service_key text;
BEGIN
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_key  := current_setting('app.settings.service_role_key', true);
  IF supabase_url IS NULL OR service_key IS NULL THEN RETURN; END IF;

  BEGIN
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/notify-google-chat',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'Authorization','Bearer '||service_key
      ),
      body := jsonb_build_object(
        'notification_type', _notification_type,
        'department', COALESCE(_department,'all'),
        'title', _title,
        'message', _message,
        'severity', COALESCE(_severity,'info'),
        'url', _url,
        'fields', _fields,
        'reference_table', _reference_table,
        'reference_id', _reference_id
      )
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;
-- 3) news_posts
DROP FUNCTION IF EXISTS public.gchat_on_news() CASCADE;
CREATE OR REPLACE FUNCTION public.gchat_on_news()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.is_published IS NOT TRUE THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.is_published IS TRUE THEN RETURN NEW; END IF;
  PERFORM public.notify_google_chat(
    'news',
    (CASE WHEN NEW.is_pinned THEN '📌 ' ELSE '📢 ' END) || NEW.title,
    COALESCE(LEFT(NEW.content,400),''),
    'all',
    CASE WHEN NEW.is_pinned THEN 'warning' ELSE 'info' END,
    NULL,
    jsonb_build_object('หมวด','ข่าวสาร','โพสต์เมื่อ', to_char(now() AT TIME ZONE 'Asia/Bangkok','DD/MM/YYYY HH24:MI')),
    'news_posts', NEW.id
  );
  RETURN NEW;
END $$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_gchat_news ON public.news_posts';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_gchat_news AFTER INSERT OR UPDATE ON public.news_posts
FOR EACH ROW EXECUTE FUNCTION public.gchat_on_news()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- 4) emergency_broadcasts
DROP FUNCTION IF EXISTS public.gchat_on_emergency() CASCADE;
CREATE OR REPLACE FUNCTION public.gchat_on_emergency()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.notify_google_chat(
    'emergency',
    '🚨 ' || NEW.title,
    COALESCE(NEW.message,''),
    'all','critical', NULL,
    jsonb_build_object('ระดับ','เร่งด่วน','เวลา', to_char(now() AT TIME ZONE 'Asia/Bangkok','DD/MM/YYYY HH24:MI')),
    'emergency_broadcasts', NEW.id
  );
  RETURN NEW;
END $$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_gchat_emergency ON public.emergency_broadcasts';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_gchat_emergency AFTER INSERT ON public.emergency_broadcasts
FOR EACH ROW EXECUTE FUNCTION public.gchat_on_emergency()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- 5) documents
DROP FUNCTION IF EXISTS public.gchat_on_document() CASCADE;
CREATE OR REPLACE FUNCTION public.gchat_on_document()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.notify_google_chat(
    'document',
    '📄 หนังสือใหม่: ' || NEW.title,
    'เลขที่ ' || COALESCE(NEW.doc_number,'-') || ' • จาก ' || COALESCE(NEW.from_department,'-'),
    'general_admin','info', NULL,
    jsonb_build_object('ประเภท', COALESCE(NEW.doc_type,'-'), 'วันที่', to_char(NEW.doc_date,'DD/MM/YYYY')),
    'documents', NEW.id
  );
  RETURN NEW;
END $$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_gchat_document ON public.documents';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_gchat_document AFTER INSERT ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.gchat_on_document()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- 6) staff_leaves
DROP FUNCTION IF EXISTS public.gchat_on_staff_leave() CASCADE;
CREATE OR REPLACE FUNCTION public.gchat_on_staff_leave()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE pname text;
BEGIN
  SELECT CONCAT(prefix, first_name, ' ', last_name) INTO pname
    FROM public.personnel WHERE id = NEW.personnel_id;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_google_chat(
      'staff_leave',
      '🏖️ คำขอลาใหม่: ' || COALESCE(pname,'-'),
      COALESCE(pname,'') || ' ขอลา ' || NEW.leave_type,
      'hr','info', NULL,
      jsonb_build_object('ตั้งแต่', to_char(NEW.start_date,'DD/MM/YYYY'), 'ถึง', to_char(NEW.end_date,'DD/MM/YYYY'), 'เหตุผล', COALESCE(NEW.reason,'-')),
      'staff_leaves', NEW.id
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    PERFORM public.notify_google_chat(
      'staff_leave_approved',
      '✅ อนุมัติลา: ' || COALESCE(pname,'-'),
      COALESCE(pname,'') || ' ได้รับอนุมัติลา ' || NEW.leave_type,
      'hr','success', NULL,
      jsonb_build_object('ตั้งแต่', to_char(NEW.start_date,'DD/MM/YYYY'), 'ถึง', to_char(NEW.end_date,'DD/MM/YYYY')),
      'staff_leaves', NEW.id
    );
  END IF;
  RETURN NEW;
END $$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_gchat_staff_leave ON public.staff_leaves';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_gchat_staff_leave AFTER INSERT OR UPDATE ON public.staff_leaves
FOR EACH ROW EXECUTE FUNCTION public.gchat_on_staff_leave()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- 7) substitute_teaching
DROP FUNCTION IF EXISTS public.gchat_on_substitute() CASCADE;
CREATE OR REPLACE FUNCTION public.gchat_on_substitute()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.substitute_teacher IS NULL OR NEW.substitute_teacher = '' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.substitute_teacher = NEW.substitute_teacher THEN RETURN NEW; END IF;

  PERFORM public.notify_google_chat(
    'substitute',
    '🔄 มอบหมายสอนแทน',
    'แทน ' || COALESCE(NEW.original_teacher,'-') || ' • ผู้สอนแทน: ' || NEW.substitute_teacher,
    'academic','info', NULL,
    jsonb_build_object('วันที่', to_char(NEW.teaching_date,'DD/MM/YYYY'), 'คาบ', COALESCE(NEW.period,'-')),
    'substitute_teaching', NEW.id
  );
  RETURN NEW;
END $$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_gchat_substitute ON public.substitute_teaching';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_gchat_substitute AFTER INSERT OR UPDATE ON public.substitute_teaching
FOR EACH ROW EXECUTE FUNCTION public.gchat_on_substitute()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- 8) serious behavior
DROP FUNCTION IF EXISTS public.gchat_on_serious_behavior() CASCADE;
CREATE OR REPLACE FUNCTION public.gchat_on_serious_behavior()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE sname text;
BEGIN
  IF NEW.behavior_type <> 'negative' THEN RETURN NEW; END IF;
  IF COALESCE(ABS(NEW.points),0) < 5 THEN RETURN NEW; END IF;

  SELECT CONCAT(prefix, first_name, ' ', last_name) INTO sname
    FROM public.students WHERE id = NEW.student_id;

  PERFORM public.notify_google_chat(
    'behavior',
    '⚠️ พฤติกรรมร้ายแรง: ' || COALESCE(sname,'-'),
    COALESCE(NEW.description,''),
    'student_affairs','warning', NULL,
    jsonb_build_object('คะแนนหัก', COALESCE(NEW.points::text,'-'), 'วันที่', to_char(NEW.record_date,'DD/MM/YYYY')),
    'behavior_records', NEW.id
  );
  RETURN NEW;
END $$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_gchat_behavior ON public.behavior_records';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_gchat_behavior AFTER INSERT ON public.behavior_records
FOR EACH ROW EXECUTE FUNCTION public.gchat_on_serious_behavior()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
