DROP FUNCTION IF EXISTS public.tg_notify_wall_reaction() CASCADE;
CREATE OR REPLACE FUNCTION public.tg_notify_wall_reaction()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_author uuid;
  v_actor_name text;
  v_label text;
BEGIN
  SELECT author_id INTO v_author FROM public.wall_posts WHERE id = NEW.post_id;
  IF v_author IS NULL OR v_author = NEW.user_id THEN RETURN NEW; END IF;
  SELECT COALESCE(NULLIF(TRIM(COALESCE(first_name,'') || ' ' || COALESCE(last_name,'')), ''), 'ผู้ใช้')
    INTO v_actor_name FROM public.profiles WHERE id = NEW.user_id;
  v_label := CASE NEW.reaction_type WHEN 'heart' THEN 'ถูกใจด้วยหัวใจ' ELSE 'กดถูกใจ' END;
  INSERT INTO public.notifications (user_id, title, message, type, reference_id, reference_type)
  VALUES (v_author, 'มีคน' || v_label || 'โพสต์ของคุณ', COALESCE(v_actor_name,'ผู้ใช้') || ' ' || v_label || 'โพสต์ของคุณ',
          'wall_reaction', NEW.post_id, 'wall_post');
  RETURN NEW;
END; $$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS wall_reaction_notify ON public.wall_post_reactions';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER wall_reaction_notify
AFTER INSERT ON public.wall_post_reactions
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_wall_reaction()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DROP FUNCTION IF EXISTS public.tg_notify_wall_comment() CASCADE;
CREATE OR REPLACE FUNCTION public.tg_notify_wall_comment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_author uuid;
  v_actor_name text;
  v_preview text;
BEGIN
  SELECT author_id INTO v_author FROM public.wall_posts WHERE id = NEW.post_id;
  IF v_author IS NULL OR v_author = NEW.user_id THEN RETURN NEW; END IF;
  SELECT COALESCE(NULLIF(TRIM(COALESCE(first_name,'') || ' ' || COALESCE(last_name,'')), ''), 'ผู้ใช้')
    INTO v_actor_name FROM public.profiles WHERE id = NEW.user_id;
  v_preview := LEFT(COALESCE(NEW.content,''), 80);
  INSERT INTO public.notifications (user_id, title, message, type, reference_id, reference_type)
  VALUES (v_author, 'มีความคิดเห็นใหม่ในโพสต์ของคุณ', COALESCE(v_actor_name,'ผู้ใช้') || ': ' || v_preview,
          'wall_comment', NEW.post_id, 'wall_post');
  RETURN NEW;
END; $$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS wall_comment_notify ON public.wall_post_comments';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER wall_comment_notify
AFTER INSERT ON public.wall_post_comments
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_wall_comment()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
