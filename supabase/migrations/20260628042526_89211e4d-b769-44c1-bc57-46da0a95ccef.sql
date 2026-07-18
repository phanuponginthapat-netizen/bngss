ALTER TABLE public.academic_events
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS source_ref_id uuid;

-- Drop old partial index, use a regular unique constraint instead
DROP INDEX IF EXISTS public.uniq_academic_events_source;
ALTER TABLE public.academic_events
  DROP CONSTRAINT IF EXISTS academic_events_source_unique;
ALTER TABLE public.academic_events
  ADD CONSTRAINT academic_events_source_unique UNIQUE (source_type, source_ref_id);

CREATE OR REPLACE FUNCTION public.sync_activity_to_calendar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.academic_events
     WHERE source_type = 'activity' AND source_ref_id = OLD.id;
    RETURN OLD;
  END IF;

  IF NEW.start_at IS NULL THEN
    DELETE FROM public.academic_events
     WHERE source_type = 'activity' AND source_ref_id = NEW.id;
    RETURN NEW;
  END IF;

  INSERT INTO public.academic_events (
    title, description, event_date, end_date, event_type, location,
    created_by, source_type, source_ref_id
  ) VALUES (
    '🏆 ' || NEW.title,
    COALESCE(NEW.description, NEW.rules),
    NEW.start_at::date,
    COALESCE(NEW.end_at::date, NEW.start_at::date),
    'activity',
    NEW.location,
    NEW.created_by,
    'activity',
    NEW.id
  )
  ON CONFLICT ON CONSTRAINT academic_events_source_unique DO UPDATE
    SET title = EXCLUDED.title,
        description = EXCLUDED.description,
        event_date = EXCLUDED.event_date,
        end_date = EXCLUDED.end_date,
        location = EXCLUDED.location,
        updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_activity_calendar ON public.activities;
CREATE TRIGGER trg_sync_activity_calendar
AFTER INSERT OR UPDATE OF title, description, rules, start_at, end_at, location ON public.activities
FOR EACH ROW EXECUTE FUNCTION public.sync_activity_to_calendar();

DROP TRIGGER IF EXISTS trg_sync_activity_calendar_del ON public.activities;
CREATE TRIGGER trg_sync_activity_calendar_del
AFTER DELETE ON public.activities
FOR EACH ROW EXECUTE FUNCTION public.sync_activity_to_calendar();

CREATE OR REPLACE FUNCTION public.notify_activity_participants_tomorrow()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, reference_id, reference_type)
  SELECT DISTINCT
    s.auth_user_id,
    '🏆 พรุ่งนี้แข่ง: ' || a.title,
    'การแข่งขัน "' || a.title || '" จะเริ่มในวันพรุ่งนี้ ' ||
      to_char(a.start_at, 'HH24:MI') ||
      COALESCE(' ที่ ' || a.location, '') ||
      ' — กดเพื่อดูกติกา / สายการแข่งขัน / สถานที่',
    'activity',
    a.id,
    'activity_reminder'
  FROM public.activities a
  JOIN public.activity_participants ap ON ap.activity_id = a.id
  JOIN public.students s ON s.id = ap.student_id
  WHERE s.auth_user_id IS NOT NULL
    AND a.start_at::date = (CURRENT_DATE + INTERVAL '1 day')::date
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = s.auth_user_id
        AND n.reference_type = 'activity_reminder'
        AND n.reference_id = a.id
    );
END;
$$;

INSERT INTO public.academic_events (
  title, description, event_date, end_date, event_type, location,
  created_by, source_type, source_ref_id
)
SELECT '🏆 ' || a.title, COALESCE(a.description, a.rules),
       a.start_at::date, COALESCE(a.end_at::date, a.start_at::date),
       'activity', a.location, a.created_by, 'activity', a.id
FROM public.activities a
WHERE a.start_at IS NOT NULL
ON CONFLICT ON CONSTRAINT academic_events_source_unique DO NOTHING;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'activity-tomorrow-reminders') THEN
    PERFORM cron.unschedule('activity-tomorrow-reminders');
  END IF;
END $$;

SELECT cron.schedule(
  'activity-tomorrow-reminders',
  '0 0 * * *',
  $$ SELECT public.notify_activity_participants_tomorrow(); $$
);