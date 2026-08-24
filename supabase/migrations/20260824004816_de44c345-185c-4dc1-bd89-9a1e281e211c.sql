CREATE OR REPLACE FUNCTION public.notify_users_on_news()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  notif_title TEXT;
  notif_msg TEXT;
  notif_url TEXT;
  base_url TEXT;
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

  INSERT INTO public.inbox_items (user_id, item_type, category, title, message, action_url, priority, reference_id, reference_table)
  SELECT ur.user_id, 'notification',
         CASE WHEN TG_TABLE_NAME = 'news_posts' THEN 'news' ELSE 'emergency' END,
         notif_title, notif_msg, notif_url,
         CASE WHEN TG_TABLE_NAME = 'emergency_broadcasts' OR NEW.is_pinned THEN 'high' ELSE 'normal' END,
         NEW.id, TG_TABLE_NAME
  FROM (SELECT DISTINCT user_id FROM public.user_roles) ur;

  SELECT value INTO base_url FROM public.app_secrets WHERE key = 'SUPABASE_URL' LIMIT 1;
  IF base_url IS NULL OR base_url = '' THEN
    base_url := current_setting('app.settings.supabase_url', true);
  END IF;
  base_url := NULLIF(rtrim(COALESCE(base_url, ''), '/'), '');

  IF base_url IS NOT NULL THEN
    BEGIN
      PERFORM net.http_post(
        url := base_url || '/functions/v1/send-push-broadcast',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := jsonb_build_object('title', notif_title, 'body', notif_msg, 'url', notif_url, 'tag', TG_TABLE_NAME::text)
      );
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  RETURN NEW;
END;
$function$;