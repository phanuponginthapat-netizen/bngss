DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.news_posts ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.emergency_broadcasts ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $idxguard$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_news_posts_pinned ON public.news_posts(is_pinned, published_at DESC)';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
DO $idxguard$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_emergency_pinned ON public.emergency_broadcasts(is_pinned, sent_at DESC)';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
-- Function: notify all users (inbox + push) when news is published or emergency is sent
DROP FUNCTION IF EXISTS public.notify_users_on_news() CASCADE;
CREATE OR REPLACE FUNCTION public.notify_users_on_news()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  u RECORD;
  notif_title TEXT;
  notif_msg TEXT;
  notif_url TEXT;
BEGIN
  IF TG_TABLE_NAME = 'news_posts' THEN
    IF NEW.is_published IS NOT TRUE THEN RETURN NEW; END IF;
    IF TG_OP = 'UPDATE' AND OLD.is_published IS TRUE THEN RETURN NEW; END IF;
    notif_title := CASE WHEN NEW.is_pinned THEN '📌 ' ELSE '📢 ' END || NEW.title;
    notif_msg := COALESCE(LEFT(NEW.content, 140), '');
    notif_url := '/dashboard/admin/news';
  ELSE
    notif_title := '🚨 ' || NEW.title;
    notif_msg := COALESCE(LEFT(NEW.message, 140), '');
    notif_url := '/dashboard/admin/news';
  END IF;

  -- Insert inbox items for all users
  INSERT INTO public.inbox_items (user_id, item_type, category, title, message, action_url, priority, reference_id, reference_table)
  SELECT ur.user_id, 'notification',
         CASE WHEN TG_TABLE_NAME = 'news_posts' THEN 'news' ELSE 'emergency' END,
         notif_title, notif_msg, notif_url,
         CASE WHEN TG_TABLE_NAME = 'emergency_broadcasts' OR NEW.is_pinned THEN 'high' ELSE 'normal' END,
         NEW.id, TG_TABLE_NAME
  FROM (SELECT DISTINCT user_id FROM public.user_roles) ur;

  -- Trigger push notifications asynchronously via pg_net (best effort, ignore errors)
  BEGIN
    PERFORM net.http_post(
      url := concat(current_setting('app.settings.supabase_url', true), '/functions/v1/send-push-broadcast'),
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('title', notif_title, 'body', notif_msg, 'url', notif_url, 'tag', TG_TABLE_NAME::text)
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN NEW;
END;
$$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_notify_news ON public.news_posts';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_notify_news
AFTER INSERT OR UPDATE ON public.news_posts
FOR EACH ROW EXECUTE FUNCTION public.notify_users_on_news()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_notify_emergency ON public.emergency_broadcasts';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_notify_emergency
AFTER INSERT ON public.emergency_broadcasts
FOR EACH ROW EXECUTE FUNCTION public.notify_users_on_news()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
