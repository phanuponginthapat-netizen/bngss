-- Add per-group notification switches for LINE Vault groups
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.line_vault_groups
  ADD COLUMN IF NOT EXISTS notify_leaves boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_substitute boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_calendar boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS calendar_digest_time time NOT NULL DEFAULT ''07:00'',
  ADD COLUMN IF NOT EXISTS last_calendar_digest_date date';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- Helper: fire an edge function via pg_net with the shared cron secret
CREATE OR REPLACE FUNCTION public.line_vault_dispatch(category text, payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_url text;
  cron_secret text;
  fn_url text;
BEGIN
  SELECT value INTO base_url FROM public.app_secrets WHERE key = 'SUPABASE_URL';
  IF base_url IS NULL THEN
    base_url := current_setting('app.settings.supabase_url', true);
  END IF;
  SELECT value INTO cron_secret FROM public.app_secrets WHERE key = 'CRON_SECRET';
  IF base_url IS NULL OR cron_secret IS NULL THEN
    RETURN;
  END IF;
  fn_url := base_url || '/functions/v1/notify-line-vault-groups';
  PERFORM net.http_post(
    url := fn_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', cron_secret
    ),
    body := jsonb_build_object('category', category, 'payload', payload)
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'line_vault_dispatch failed: %', SQLERRM;
END;
$$;
-- staff_leaves triggers (insert + status change)
CREATE OR REPLACE FUNCTION public.trg_line_vault_staff_leave()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pname text;
  action text;
BEGIN
  SELECT full_name INTO pname FROM public.personnel WHERE id = NEW.personnel_id;
  IF TG_OP = 'INSERT' THEN
    action := 'new';
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    action := NEW.status;
  ELSE
    RETURN NEW;
  END IF;
  PERFORM public.line_vault_dispatch('leaves', jsonb_build_object(
    'kind', 'staff_leave',
    'action', action,
    'name', COALESCE(pname, 'บุคลากร'),
    'leave_type', NEW.leave_type,
    'start_date', NEW.start_date,
    'end_date', NEW.end_date,
    'reason', NEW.reason,
    'approved_by', NEW.approved_by,
    'rejected_reason', NEW.rejected_reason,
    'id', NEW.id
  ));
  RETURN NEW;
END;
$$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS line_vault_staff_leave_ins ON public.staff_leaves';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS line_vault_staff_leave_upd ON public.staff_leaves';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER line_vault_staff_leave_ins
  AFTER INSERT ON public.staff_leaves
  FOR EACH ROW EXECUTE FUNCTION public.trg_line_vault_staff_leave()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS line_vault_staff_leave_upd ON public.staff_leaves';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER line_vault_staff_leave_upd
  AFTER UPDATE OF status ON public.staff_leaves
  FOR EACH ROW EXECUTE FUNCTION public.trg_line_vault_staff_leave()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- student_leaves triggers
CREATE OR REPLACE FUNCTION public.trg_line_vault_student_leave()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sname text;
  cname text;
  action text;
BEGIN
  SELECT (s.first_name || ' ' || s.last_name), c.name
    INTO sname, cname
    FROM public.students s
    LEFT JOIN public.classrooms c ON c.id = s.classroom_id
   WHERE s.id = NEW.student_id;
  IF TG_OP = 'INSERT' THEN
    action := 'new';
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    action := NEW.status;
  ELSE
    RETURN NEW;
  END IF;
  PERFORM public.line_vault_dispatch('leaves', jsonb_build_object(
    'kind', 'student_leave',
    'action', action,
    'name', COALESCE(sname, 'นักเรียน'),
    'classroom', cname,
    'leave_type', NEW.leave_type,
    'start_date', NEW.start_date,
    'end_date', NEW.end_date,
    'reason', NEW.reason,
    'id', NEW.id
  ));
  RETURN NEW;
END;
$$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS line_vault_student_leave_ins ON public.student_leaves';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS line_vault_student_leave_upd ON public.student_leaves';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER line_vault_student_leave_ins
  AFTER INSERT ON public.student_leaves
  FOR EACH ROW EXECUTE FUNCTION public.trg_line_vault_student_leave()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS line_vault_student_leave_upd ON public.student_leaves';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER line_vault_student_leave_upd
  AFTER UPDATE OF status ON public.student_leaves
  FOR EACH ROW EXECUTE FUNCTION public.trg_line_vault_student_leave()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- substitute_teaching insert trigger
CREATE OR REPLACE FUNCTION public.trg_line_vault_substitute()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sub_name text;
  cls_name text;
BEGIN
  SELECT name INTO sub_name FROM public.subjects WHERE id = NEW.subject_id;
  SELECT name INTO cls_name FROM public.classrooms WHERE id = NEW.classroom_id;
  PERFORM public.line_vault_dispatch('substitute', jsonb_build_object(
    'kind', 'substitute',
    'original', NEW.original_teacher,
    'substitute', NEW.substitute_teacher,
    'date', NEW.teaching_date,
    'period', NEW.period,
    'subject', sub_name,
    'classroom', cls_name,
    'notes', NEW.notes,
    'id', NEW.id
  ));
  RETURN NEW;
END;
$$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS line_vault_substitute_ins ON public.substitute_teaching';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER line_vault_substitute_ins
  AFTER INSERT ON public.substitute_teaching
  FOR EACH ROW EXECUTE FUNCTION public.trg_line_vault_substitute()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- Schedule daily calendar digest at 07:00 Asia/Bangkok (00:00 UTC)
DO $$
DECLARE
  base_url text;
  cron_secret text;
BEGIN
  SELECT value INTO base_url FROM public.app_secrets WHERE key = 'SUPABASE_URL';
  SELECT value INTO cron_secret FROM public.app_secrets WHERE key = 'CRON_SECRET';
  IF base_url IS NULL OR cron_secret IS NULL THEN
    RAISE NOTICE 'Skipping cron schedule — SUPABASE_URL or CRON_SECRET not set in app_secrets';
    RETURN;
  END IF;
  PERFORM cron.unschedule('line-vault-calendar-digest') FROM cron.job WHERE jobname = 'line-vault-calendar-digest';
  PERFORM cron.schedule(
    'line-vault-calendar-digest',
    '0 0 * * *',
    format($cmd$
      SELECT net.http_post(
        url := %L,
        headers := %L::jsonb,
        body := '{}'::jsonb
      );
    $cmd$,
      base_url || '/functions/v1/notify-calendar-digest',
      jsonb_build_object('Content-Type','application/json','x-cron-secret', cron_secret)::text
    )
  );
END $$;
