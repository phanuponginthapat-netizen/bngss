-- Notify post author when someone reacts or comments on their wall post
DROP FUNCTION IF EXISTS public.notify_wall_post_reaction() CASCADE;
CREATE OR REPLACE FUNCTION public.notify_wall_post_reaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author uuid;
  v_actor_name text;
  v_emoji text;
BEGIN
  SELECT author_id INTO v_author FROM public.wall_posts WHERE id = NEW.post_id;
  IF v_author IS NULL OR v_author = NEW.user_id THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE(full_name, 'มีผู้ใช้') INTO v_actor_name FROM public.profiles WHERE id = NEW.user_id;
  v_emoji := CASE NEW.reaction_type
    WHEN 'heart' THEN '❤️'
    WHEN 'like' THEN '👍'
    WHEN 'wow' THEN '😮'
    WHEN 'haha' THEN '😄'
    WHEN 'sad' THEN '😢'
    WHEN 'care' THEN '🤗'
    ELSE '👍'
  END;
  INSERT INTO public.notifications (user_id, title, message, type, reference_id, reference_type)
  VALUES (
    v_author,
    v_emoji || ' ' || v_actor_name || ' มีปฏิกิริยากับโพสต์ของคุณ',
    'กดดูเพื่อตอบกลับ',
    'wall_reaction',
    NEW.post_id,
    'wall_post'
  );
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
      EXECUTE 'DROP TRIGGER IF EXISTS trg_notify_wall_reaction ON public.wall_post_reactions';
    EXIT;
    EXCEPTION
      WHEN deadlock_detected OR lock_not_available THEN
        _ddl_try := _ddl_try + 1;
        IF _ddl_try >= 10 THEN
          RAISE NOTICE 'giving up after lock contention: %', SQLERRM;
          EXIT;
        END IF;
        PERFORM pg_sleep(0.4 * _ddl_try);
      WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
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
      EXECUTE 'CREATE TRIGGER trg_notify_wall_reaction
    AFTER INSERT ON public.wall_post_reactions
    FOR EACH ROW EXECUTE FUNCTION public.notify_wall_post_reaction()';
    EXIT;
    EXCEPTION
      WHEN deadlock_detected OR lock_not_available THEN
        _ddl_try := _ddl_try + 1;
        IF _ddl_try >= 10 THEN
          RAISE NOTICE 'giving up after lock contention: %', SQLERRM;
          EXIT;
        END IF;
        PERFORM pg_sleep(0.4 * _ddl_try);
      WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
        RAISE NOTICE 'skipped: %', SQLERRM;
        EXIT;
    END;
  END LOOP;
END
$guard$;
DROP FUNCTION IF EXISTS public.notify_wall_post_comment() CASCADE;
CREATE OR REPLACE FUNCTION public.notify_wall_post_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author uuid;
  v_parent_author uuid;
  v_actor_name text;
  v_preview text;
BEGIN
  SELECT author_id INTO v_author FROM public.wall_posts WHERE id = NEW.post_id;
  SELECT COALESCE(full_name, 'มีผู้ใช้') INTO v_actor_name FROM public.profiles WHERE id = NEW.user_id;
  v_preview := LEFT(COALESCE(NEW.content, ''), 80);

  -- Notify post author
  IF v_author IS NOT NULL AND v_author <> NEW.user_id THEN
    INSERT INTO public.notifications (user_id, title, message, type, reference_id, reference_type)
    VALUES (
      v_author,
      '💬 ' || v_actor_name || ' แสดงความคิดเห็นโพสต์ของคุณ',
      v_preview,
      'wall_comment',
      NEW.post_id,
      'wall_post'
    );
  END IF;

  -- Notify parent comment author (reply)
  IF NEW.parent_id IS NOT NULL THEN
    SELECT user_id INTO v_parent_author FROM public.wall_post_comments WHERE id = NEW.parent_id;
    IF v_parent_author IS NOT NULL AND v_parent_author <> NEW.user_id AND v_parent_author <> v_author THEN
      INSERT INTO public.notifications (user_id, title, message, type, reference_id, reference_type)
      VALUES (
        v_parent_author,
        '↩️ ' || v_actor_name || ' ตอบกลับความคิดเห็นของคุณ',
        v_preview,
        'wall_reply',
        NEW.post_id,
        'wall_post'
      );
    END IF;
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
      EXECUTE 'DROP TRIGGER IF EXISTS trg_notify_wall_comment ON public.wall_post_comments';
    EXIT;
    EXCEPTION
      WHEN deadlock_detected OR lock_not_available THEN
        _ddl_try := _ddl_try + 1;
        IF _ddl_try >= 10 THEN
          RAISE NOTICE 'giving up after lock contention: %', SQLERRM;
          EXIT;
        END IF;
        PERFORM pg_sleep(0.4 * _ddl_try);
      WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
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
      EXECUTE 'CREATE TRIGGER trg_notify_wall_comment
    AFTER INSERT ON public.wall_post_comments
    FOR EACH ROW EXECUTE FUNCTION public.notify_wall_post_comment()';
    EXIT;
    EXCEPTION
      WHEN deadlock_detected OR lock_not_available THEN
        _ddl_try := _ddl_try + 1;
        IF _ddl_try >= 10 THEN
          RAISE NOTICE 'giving up after lock contention: %', SQLERRM;
          EXIT;
        END IF;
        PERFORM pg_sleep(0.4 * _ddl_try);
      WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
        RAISE NOTICE 'skipped: %', SQLERRM;
        EXIT;
    END;
  END LOOP;
END
$guard$;
