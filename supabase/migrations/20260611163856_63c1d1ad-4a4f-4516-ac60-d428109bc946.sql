DROP FUNCTION IF EXISTS public.notify_on_garbage_redemption() CASCADE;
CREATE OR REPLACE FUNCTION public.notify_on_garbage_redemption()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  reward_name text;
BEGIN
  IF NEW.points_used IS NULL OR NEW.points_used <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT name INTO reward_name FROM public.garbage_rewards WHERE id = NEW.reward_id;

  IF NEW.student_id IS NOT NULL THEN
    SELECT auth_user_id INTO uid FROM public.students WHERE id = NEW.student_id;
  ELSIF NEW.personnel_id IS NOT NULL THEN
    SELECT user_id INTO uid FROM public.personnel WHERE id = NEW.personnel_id;
  END IF;

  IF uid IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, reference_type, reference_id)
    VALUES (
      uid,
      '🎁 แลกของรางวัลสำเร็จ',
      'คุณใช้ ' || NEW.points_used || ' แต้ม แลก "' || COALESCE(reward_name, 'ของรางวัล') || '" จำนวน ' || NEW.quantity || ' ชิ้น',
      'garbage_redemption',
      'garbage_redemption',
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
      EXECUTE 'DROP TRIGGER IF EXISTS trg_notify_garbage_redemption ON public.garbage_redemptions';
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
      EXECUTE 'CREATE TRIGGER trg_notify_garbage_redemption
      AFTER INSERT ON public.garbage_redemptions
      FOR EACH ROW EXECUTE FUNCTION public.notify_on_garbage_redemption()';
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
