CREATE OR REPLACE FUNCTION public.notify_on_staff_leave()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE recipient_id UUID; personnel_name TEXT;
BEGIN
  SELECT CONCAT(prefix, first_name, ' ', last_name) INTO personnel_name
  FROM public.personnel WHERE id = NEW.personnel_id;

  FOR recipient_id IN
    SELECT DISTINCT user_id FROM public.user_roles
    WHERE role IN ('admin','director') AND user_id IS NOT NULL
  LOOP
    -- Dedup by recipient + logical event (personnel + dates + type) within 10 minutes,
    -- not by NEW.id — so a duplicate submission producing a new row is still deduped.
    IF EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = recipient_id
        AND n.reference_type = 'staff_leave'
        AND n.type = 'leave'
        AND n.created_at > now() - interval '10 minutes'
        AND n.message = COALESCE(personnel_name, '') || ' ขอลา' || NEW.leave_type || ' วันที่ ' || NEW.start_date || ' - ' || NEW.end_date
    ) THEN CONTINUE; END IF;

    INSERT INTO public.notifications (user_id, title, message, type, reference_type, reference_id)
    VALUES (
      recipient_id,
      'คำขอลา: ' || COALESCE(personnel_name, 'ไม่ระบุ'),
      COALESCE(personnel_name, '') || ' ขอลา' || NEW.leave_type || ' วันที่ ' || NEW.start_date || ' - ' || NEW.end_date,
      'leave','staff_leave', NEW.id
    );
  END LOOP;
  RETURN NEW;
END; $function$;

-- Clean up existing duplicates from today (keep earliest per user + message)
DELETE FROM public.notifications a
USING public.notifications b
WHERE a.reference_type = 'staff_leave'
  AND b.reference_type = 'staff_leave'
  AND a.user_id = b.user_id
  AND a.message = b.message
  AND a.created_at > b.created_at
  AND b.created_at > now() - interval '2 days';