CREATE OR REPLACE FUNCTION public.notify_wall_post_reaction()
RETURNS trigger
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
  SELECT COALESCE(NULLIF(TRIM(CONCAT_WS(' ', first_name, last_name)), ''), 'มีผู้ใช้')
    INTO v_actor_name FROM public.profiles WHERE id = NEW.user_id;
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
    v_emoji || ' ' || COALESCE(v_actor_name, 'มีผู้ใช้') || ' มีปฏิกิริยากับโพสต์ของคุณ',
    'กดดูเพื่อตอบกลับ',
    'wall_reaction',
    NEW.post_id,
    'wall_post'
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_wall_post_comment()
RETURNS trigger
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
  SELECT COALESCE(NULLIF(TRIM(CONCAT_WS(' ', first_name, last_name)), ''), 'มีผู้ใช้')
    INTO v_actor_name FROM public.profiles WHERE id = NEW.user_id;
  v_preview := LEFT(COALESCE(NEW.content, ''), 80);

  IF v_author IS NOT NULL AND v_author <> NEW.user_id THEN
    INSERT INTO public.notifications (user_id, title, message, type, reference_id, reference_type)
    VALUES (
      v_author,
      '💬 ' || COALESCE(v_actor_name, 'มีผู้ใช้') || ' แสดงความคิดเห็นโพสต์ของคุณ',
      v_preview,
      'wall_comment',
      NEW.post_id,
      'wall_post'
    );
  END IF;

  IF NEW.parent_id IS NOT NULL THEN
    SELECT user_id INTO v_parent_author FROM public.wall_post_comments WHERE id = NEW.parent_id;
    IF v_parent_author IS NOT NULL AND v_parent_author <> NEW.user_id AND v_parent_author <> v_author THEN
      INSERT INTO public.notifications (user_id, title, message, type, reference_id, reference_type)
      VALUES (
        v_parent_author,
        '↩️ ' || COALESCE(v_actor_name, 'มีผู้ใช้') || ' ตอบกลับความคิดเห็นของคุณ',
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