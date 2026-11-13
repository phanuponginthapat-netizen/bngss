DROP TRIGGER IF EXISTS trg_sync_notification_to_inbox ON public.notifications;
CREATE OR REPLACE FUNCTION public.sync_notification_to_inbox()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.id::text, 0));
  IF NOT EXISTS (SELECT 1 FROM public.inbox_items WHERE notification_id = NEW.id) THEN
    INSERT INTO public.inbox_items (user_id,title,message,item_type,category,reference_table,reference_id,priority,notification_id)
    VALUES (NEW.user_id,NEW.title,NEW.message,'notification',NEW.type,NEW.reference_type,NEW.reference_id,
      CASE WHEN NEW.type='emergency' THEN 'urgent' WHEN NEW.type IN ('leave','behavior') THEN 'high' ELSE 'normal' END,NEW.id);
  END IF;
  RETURN NEW;
END $function$;
CREATE OR REPLACE FUNCTION public.trigger_push_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE backend_url TEXT; service_key TEXT; has_sub BOOLEAN;
BEGIN
  IF NEW.push_sent THEN RETURN NEW; END IF;
  SELECT EXISTS (SELECT 1 FROM public.push_subscriptions WHERE user_id=NEW.user_id) INTO has_sub;
  IF NOT has_sub THEN RETURN NEW; END IF;
  backend_url := current_setting('app.settings.supabase_url',true);
  service_key := current_setting('app.settings.service_role_key',true);
  IF backend_url IS NULL OR service_key IS NULL THEN RETURN NEW; END IF;
  BEGIN
    PERFORM extensions.http_post(
      url := backend_url || '/functions/v1/send-push',
      body := json_build_object('user_id',NEW.user_id,'title',NEW.title,'body',COALESCE(NEW.message,''),'url','/dashboard/inbox','tag','notifications-' || NEW.id::text)::text,
      headers := json_build_object('Content-Type','application/json','Authorization','Bearer ' || service_key)::jsonb);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN NEW;
END $function$;