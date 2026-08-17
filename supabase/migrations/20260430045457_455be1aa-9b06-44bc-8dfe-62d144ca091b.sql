-- Trigger: ส่ง notification ในระบบเมื่อได้แต้มจากการฝากขยะ (จะ trigger push อัตโนมัติผ่าน trigger_push_notification ที่มีอยู่)
DROP FUNCTION IF EXISTS public.notify_on_garbage_deposit() CASCADE;
CREATE OR REPLACE FUNCTION public.notify_on_garbage_deposit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  uname text;
BEGIN
  IF NEW.points_earned IS NULL OR NEW.points_earned <= 0 THEN
    RETURN NEW;
  END IF;

  IF NEW.student_id IS NOT NULL THEN
    SELECT auth_user_id, CONCAT(prefix, first_name, ' ', last_name) INTO uid, uname
    FROM public.students WHERE id = NEW.student_id;
  ELSIF NEW.personnel_id IS NOT NULL THEN
    SELECT user_id, CONCAT(prefix, first_name, ' ', last_name) INTO uid, uname
    FROM public.personnel WHERE id = NEW.personnel_id;
  END IF;

  IF uid IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, reference_type, reference_id)
    VALUES (
      uid,
      '🎉 ได้รับแต้มจากธนาคารขยะ',
      'คุณได้รับ +' || NEW.points_earned || ' แต้ม จากการฝากขยะ',
      'garbage_points',
      'garbage_deposit',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'DROP TRIGGER IF EXISTS trg_notify_garbage_deposit ON public.garbage_deposits';
    EXIT;
    EXCEPTION
      WHEN deadlock_detected OR lock_not_available THEN
        _ddl_try := _ddl_try + 1;
        IF _ddl_try >= 10 THEN
          RAISE NOTICE 'giving up after lock contention: %', SQLERRM;
          EXIT;
        END IF;
        PERFORM pg_sleep(0.4 * _ddl_try);
      WHEN insufficient_privilege OR undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
        RAISE NOTICE 'skipped: %', SQLERRM;
        EXIT;
    END;
  END LOOP;
END
$guard$;
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'CREATE TRIGGER trg_notify_garbage_deposit
      AFTER INSERT ON public.garbage_deposits
      FOR EACH ROW EXECUTE FUNCTION public.notify_on_garbage_deposit()';
    EXIT;
    EXCEPTION
      WHEN deadlock_detected OR lock_not_available THEN
        _ddl_try := _ddl_try + 1;
        IF _ddl_try >= 10 THEN
          RAISE NOTICE 'giving up after lock contention: %', SQLERRM;
          EXIT;
        END IF;
        PERFORM pg_sleep(0.4 * _ddl_try);
      WHEN insufficient_privilege OR undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
        RAISE NOTICE 'skipped: %', SQLERRM;
        EXIT;
    END;
  END LOOP;
END
$guard$;
-- Trigger: notify เมื่อได้รับ Badge ใหม่
DROP FUNCTION IF EXISTS public.notify_on_badge_earned() CASCADE;
CREATE OR REPLACE FUNCTION public.notify_on_badge_earned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  badge_name text;
  badge_icon text;
BEGIN
  SELECT name, COALESCE(icon, '🏆') INTO badge_name, badge_icon
  FROM public.garbage_badges WHERE id = NEW.badge_id;

  IF NEW.student_id IS NOT NULL THEN
    SELECT auth_user_id INTO uid FROM public.students WHERE id = NEW.student_id;
  ELSIF NEW.personnel_id IS NOT NULL THEN
    SELECT user_id INTO uid FROM public.personnel WHERE id = NEW.personnel_id;
  END IF;

  IF uid IS NOT NULL AND badge_name IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, reference_type, reference_id)
    VALUES (
      uid,
      badge_icon || ' ปลดล็อก Badge ใหม่!',
      'คุณได้รับเหรียญ "' || badge_name || '" ขอแสดงความยินดีด้วย',
      'garbage_badge',
      'garbage_user_badge',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'DROP TRIGGER IF EXISTS trg_notify_badge_earned ON public.garbage_user_badges';
    EXIT;
    EXCEPTION
      WHEN deadlock_detected OR lock_not_available THEN
        _ddl_try := _ddl_try + 1;
        IF _ddl_try >= 10 THEN
          RAISE NOTICE 'giving up after lock contention: %', SQLERRM;
          EXIT;
        END IF;
        PERFORM pg_sleep(0.4 * _ddl_try);
      WHEN insufficient_privilege OR undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
        RAISE NOTICE 'skipped: %', SQLERRM;
        EXIT;
    END;
  END LOOP;
END
$guard$;
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'CREATE TRIGGER trg_notify_badge_earned
      AFTER INSERT ON public.garbage_user_badges
      FOR EACH ROW EXECUTE FUNCTION public.notify_on_badge_earned()';
    EXIT;
    EXCEPTION
      WHEN deadlock_detected OR lock_not_available THEN
        _ddl_try := _ddl_try + 1;
        IF _ddl_try >= 10 THEN
          RAISE NOTICE 'giving up after lock contention: %', SQLERRM;
          EXIT;
        END IF;
        PERFORM pg_sleep(0.4 * _ddl_try);
      WHEN insufficient_privilege OR undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
        RAISE NOTICE 'skipped: %', SQLERRM;
        EXIT;
    END;
  END LOOP;
END
$guard$;
-- เพิ่ม trigger ส่ง push สำหรับ notifications ที่สร้างใหม่ (ถ้ายังไม่มี)
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'DROP TRIGGER IF EXISTS trg_push_on_notification ON public.notifications';
    EXIT;
    EXCEPTION
      WHEN deadlock_detected OR lock_not_available THEN
        _ddl_try := _ddl_try + 1;
        IF _ddl_try >= 10 THEN
          RAISE NOTICE 'giving up after lock contention: %', SQLERRM;
          EXIT;
        END IF;
        PERFORM pg_sleep(0.4 * _ddl_try);
      WHEN insufficient_privilege OR undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
        RAISE NOTICE 'skipped: %', SQLERRM;
        EXIT;
    END;
  END LOOP;
END
$guard$;
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'CREATE TRIGGER trg_push_on_notification
      AFTER INSERT ON public.notifications
      FOR EACH ROW EXECUTE FUNCTION public.trigger_push_notification()';
    EXIT;
    EXCEPTION
      WHEN deadlock_detected OR lock_not_available THEN
        _ddl_try := _ddl_try + 1;
        IF _ddl_try >= 10 THEN
          RAISE NOTICE 'giving up after lock contention: %', SQLERRM;
          EXIT;
        END IF;
        PERFORM pg_sleep(0.4 * _ddl_try);
      WHEN insufficient_privilege OR undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
        RAISE NOTICE 'skipped: %', SQLERRM;
        EXIT;
    END;
  END LOOP;
END
$guard$;
