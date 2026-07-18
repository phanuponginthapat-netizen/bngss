CREATE OR REPLACE FUNCTION public.notify_wall_post_reaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    v_emoji || ' ' || v_actor_name || ' มีปฏิกิริยากับโพสต์ของคุณ',
    'กดดูเพื่อตอบกลับ',
    'wall_reaction',
    NEW.post_id,
    'wall_post'
  );
  RETURN NEW;
END;
$function$;