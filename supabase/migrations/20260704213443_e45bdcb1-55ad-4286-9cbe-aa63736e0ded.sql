-- Helper: notify admins + directors
DROP FUNCTION IF EXISTS public.notify_admins_directors(text, text, text, text, uuid) CASCADE;
CREATE OR REPLACE FUNCTION public.notify_admins_directors(_title text, _message text, _type text, _ref_type text, _ref_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, reference_type, reference_id)
  SELECT ur.user_id, _title, _message, _type, _ref_type, _ref_id
  FROM public.user_roles ur
  WHERE ur.role IN ('admin','director');
END;
$$;
-- 1) ICT loan: notify borrower on approval / return
DROP FUNCTION IF EXISTS public.notify_ict_loan_status_change() CASCADE;
CREATE OR REPLACE FUNCTION public.notify_ict_loan_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  borrower_user uuid;
  device_name text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT id INTO device_name FROM public.ict_devices WHERE id = NEW.device_id LIMIT 1;
    SELECT COALESCE(device_code, name) INTO device_name FROM public.ict_devices WHERE id = NEW.device_id LIMIT 1;

    borrower_user := NEW.borrowed_by;
    IF borrower_user IS NULL THEN RETURN NEW; END IF;

    IF NEW.status = 'approved' THEN
      INSERT INTO public.notifications(user_id, title, message, type, reference_type, reference_id)
      VALUES (borrower_user, '✅ ยืมอุปกรณ์ ICT อนุมัติแล้ว',
              COALESCE('อุปกรณ์: ' || device_name, 'คำขอยืมของคุณได้รับการอนุมัติแล้ว'),
              'ict_loan', 'ict_loan', NEW.id);
    ELSIF NEW.status = 'returned' THEN
      INSERT INTO public.notifications(user_id, title, message, type, reference_type, reference_id)
      VALUES (borrower_user, '📦 บันทึกคืนอุปกรณ์แล้ว',
              'ขอบคุณที่คืนอุปกรณ์ตรงเวลา',
              'ict_loan', 'ict_loan', NEW.id);
    ELSIF NEW.status = 'rejected' THEN
      INSERT INTO public.notifications(user_id, title, message, type, reference_type, reference_id)
      VALUES (borrower_user, '❌ คำขอยืมอุปกรณ์ถูกปฏิเสธ',
              'ตรวจสอบเหตุผลการปฏิเสธในระบบ',
              'ict_loan', 'ict_loan', NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_ict_loan_notify ON public.ict_loans';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_ict_loan_notify
AFTER UPDATE OF status ON public.ict_loans
FOR EACH ROW EXECUTE FUNCTION public.notify_ict_loan_status_change()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- 2) Health measurement: notify the student
DROP FUNCTION IF EXISTS public.notify_health_measurement() CASCADE;
CREATE OR REPLACE FUNCTION public.notify_health_measurement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user uuid;
BEGIN
  SELECT auth_user_id INTO target_user FROM public.students WHERE id = NEW.student_id;
  IF target_user IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, title, message, type, reference_type, reference_id)
    VALUES (target_user, '📏 บันทึกสุขภาพใหม่',
            'มีการบันทึกน้ำหนัก/ส่วนสูงของคุณ ตรวจสอบได้ในเมนูสุขภาพ',
            'health', 'health_measurement', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_health_measurement_notify ON public.health_measurements';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_health_measurement_notify
AFTER INSERT ON public.health_measurements
FOR EACH ROW EXECUTE FUNCTION public.notify_health_measurement()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- 3) Asset damage report: notify admins + directors
DROP FUNCTION IF EXISTS public.notify_asset_damage_report() CASCADE;
CREATE OR REPLACE FUNCTION public.notify_asset_damage_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  asset_name text;
BEGIN
  SELECT COALESCE(name, code) INTO asset_name FROM public.assets WHERE id = NEW.asset_id LIMIT 1;
  PERFORM public.notify_admins_directors(
    '⚠️ แจ้งอุปกรณ์ชำรุด',
    COALESCE('อุปกรณ์: ' || asset_name || E'\n' || 'ผู้แจ้ง: ' || NEW.reporter_name, 'มีการแจ้งอุปกรณ์ชำรุดใหม่'),
    'asset_damage', 'asset_damage_report', NEW.id
  );
  RETURN NEW;
END;
$$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_asset_damage_notify ON public.asset_damage_reports';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_asset_damage_notify
AFTER INSERT ON public.asset_damage_reports
FOR EACH ROW EXECUTE FUNCTION public.notify_asset_damage_report()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- 4) Vaccine record: notify the student
DROP FUNCTION IF EXISTS public.notify_vaccine_record() CASCADE;
CREATE OR REPLACE FUNCTION public.notify_vaccine_record()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user uuid;
BEGIN
  SELECT auth_user_id INTO target_user FROM public.students WHERE id = NEW.student_id;
  IF target_user IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, title, message, type, reference_type, reference_id)
    VALUES (target_user, '💉 บันทึกการฉีดวัคซีน',
            COALESCE('วัคซีน: ' || NEW.vaccine_name, 'มีการบันทึกวัคซีนใหม่ในแฟ้มของคุณ'),
            'vaccine', 'vaccine_record', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_vaccine_notify ON public.vaccine_records';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_vaccine_notify
AFTER INSERT ON public.vaccine_records
FOR EACH ROW EXECUTE FUNCTION public.notify_vaccine_record()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
