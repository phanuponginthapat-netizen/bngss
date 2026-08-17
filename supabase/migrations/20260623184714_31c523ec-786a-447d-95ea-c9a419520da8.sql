CREATE TABLE IF NOT EXISTS public.wall_reaction_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid,
  actor_id uuid,
  author_id uuid,
  reaction_type text,
  action text NOT NULL,
  notification_id uuid,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
DO $guard$
BEGIN
  EXECUTE 'GRANT SELECT ON public.wall_reaction_audit TO authenticated';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'GRANT ALL ON public.wall_reaction_audit TO service_role';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.wall_reaction_audit ENABLE ROW LEVEL SECURITY';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "admins_view_audit" ON public.wall_reaction_audit';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "admins_view_audit" ON public.wall_reaction_audit';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "admins_view_audit" ON public.wall_reaction_audit
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),''admin'') OR public.has_role(auth.uid(),''director''))';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DROP FUNCTION IF EXISTS public.notify_wall_post_reaction() CASCADE;
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
  v_notif_id uuid;
BEGIN
  SELECT author_id INTO v_author FROM public.wall_posts WHERE id = NEW.post_id;
  IF v_author IS NULL OR v_author = NEW.user_id THEN
    INSERT INTO public.wall_reaction_audit(post_id, actor_id, author_id, reaction_type, action)
    VALUES (NEW.post_id, NEW.user_id, v_author, NEW.reaction_type, 'reaction_skipped_self_or_missing');
    RETURN NEW;
  END IF;
  SELECT COALESCE(NULLIF(TRIM(CONCAT_WS(' ', first_name, last_name)), ''), 'มีผู้ใช้')
    INTO v_actor_name FROM public.profiles WHERE id = NEW.user_id;
  v_emoji := CASE NEW.reaction_type
    WHEN 'heart' THEN '❤️' WHEN 'like' THEN '👍' WHEN 'wow' THEN '😮'
    WHEN 'haha' THEN '😄' WHEN 'sad' THEN '😢' WHEN 'care' THEN '🤗'
    ELSE '👍' END;
  BEGIN
    INSERT INTO public.notifications (user_id, title, message, type, reference_id, reference_type)
    VALUES (v_author, v_emoji||' '||v_actor_name||' มีปฏิกิริยากับโพสต์ของคุณ',
            'กดดูเพื่อตอบกลับ','wall_reaction', NEW.post_id,'wall_post')
    RETURNING id INTO v_notif_id;
    INSERT INTO public.wall_reaction_audit(post_id, actor_id, author_id, reaction_type, action, notification_id)
    VALUES (NEW.post_id, NEW.user_id, v_author, NEW.reaction_type, 'notification_created', v_notif_id);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.wall_reaction_audit(post_id, actor_id, author_id, reaction_type, action, error)
    VALUES (NEW.post_id, NEW.user_id, v_author, NEW.reaction_type, 'notification_failed', SQLERRM);
  END;
  RETURN NEW;
END;
$function$;
