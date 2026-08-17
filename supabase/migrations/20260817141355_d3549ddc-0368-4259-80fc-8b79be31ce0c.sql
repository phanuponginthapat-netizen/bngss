ALTER TABLE public.time_clock ADD COLUMN IF NOT EXISTS temperature_c numeric(4,1);

DROP FUNCTION IF EXISTS public.kiosk_clock_personnel(uuid, text, text, real) CASCADE;
DROP FUNCTION IF EXISTS public.kiosk_clock_personnel(uuid, text, text, real, numeric) CASCADE;

CREATE OR REPLACE FUNCTION public.kiosk_clock_personnel(
  _personnel_id uuid,
  _mode text DEFAULT 'entry',
  _photo_url text DEFAULT NULL,
  _confidence real DEFAULT NULL,
  _temperature_c numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  _today date := (now() AT TIME ZONE 'Asia/Bangkok')::date;
  _now timestamptz := now();
  _row public.time_clock%ROWTYPE;
  _note text := 'Face kiosk' || CASE WHEN _confidence IS NOT NULL THEN ' (' || round((_confidence*100)::numeric, 1) || '%)' ELSE '' END
                || CASE WHEN _temperature_c IS NOT NULL THEN ' • ' || _temperature_c::text || '°C' ELSE '' END;
BEGIN
  IF _personnel_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_personnel');
  END IF;

  SELECT * INTO _row FROM public.time_clock
   WHERE personnel_id = _personnel_id AND clock_date = _today
   LIMIT 1;

  IF _mode = 'exit' THEN
    IF _row.id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'no_clock_in');
    END IF;
    IF _row.clock_out IS NOT NULL AND _now - _row.clock_out < interval '5 minutes' THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'duplicate', 'clock_out', _row.clock_out);
    END IF;
    IF _row.clock_in IS NOT NULL AND _now - _row.clock_in < interval '5 minutes' THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'too_soon', 'clock_in', _row.clock_in);
    END IF;
    UPDATE public.time_clock
       SET clock_out = _now,
           clock_out_photo_url = COALESCE(_photo_url, clock_out_photo_url),
           temperature_c = COALESCE(_temperature_c, temperature_c),
           notes = COALESCE(notes, '') || CASE WHEN notes IS NULL THEN _note ELSE ' | ' || _note END
     WHERE id = _row.id
     RETURNING * INTO _row;
    RETURN jsonb_build_object('ok', true, 'action', 'clock_out', 'clock_out', _row.clock_out);
  END IF;

  IF _row.id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'duplicate', 'clock_in', _row.clock_in);
  END IF;

  INSERT INTO public.time_clock (personnel_id, clock_date, clock_in, status, notes, clock_in_photo_url, temperature_c)
  VALUES (
    _personnel_id, _today, _now,
    CASE WHEN (_now AT TIME ZONE 'Asia/Bangkok')::time > time '08:30' THEN 'late' ELSE 'normal' END,
    _note, _photo_url, _temperature_c
  )
  ON CONFLICT (personnel_id, clock_date) DO NOTHING
  RETURNING * INTO _row;

  IF _row.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'duplicate');
  END IF;

  RETURN jsonb_build_object('ok', true, 'action', 'clock_in', 'clock_in', _row.clock_in, 'status', _row.status);
END;
$fn$;

REVOKE ALL ON FUNCTION public.kiosk_clock_personnel(uuid, text, text, real, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kiosk_clock_personnel(uuid, text, text, real, numeric) TO authenticated, service_role;

-- Auto-create a health record when a student is flagged with fever at the smart gate
CREATE OR REPLACE FUNCTION public.smart_gate_fever_health_record()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  _today date := (now() AT TIME ZONE 'Asia/Bangkok')::date;
BEGIN
  IF NEW.event_type = 'fever'
     AND COALESCE(NEW.subject_kind, 'student') = 'student'
     AND NEW.subject_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.students s WHERE s.id = NEW.subject_id)
     AND NOT EXISTS (
       SELECT 1 FROM public.health_records h
        WHERE h.student_id = NEW.subject_id
          AND h.visit_date = _today
          AND h.symptoms LIKE 'ไข้สูง%'
     )
  THEN
    INSERT INTO public.health_records (student_id, visit_date, symptoms, treatment, nurse_name, follow_up_needed)
    VALUES (
      NEW.subject_id, _today,
      'ไข้สูง' || CASE WHEN NEW.temperature_c IS NOT NULL THEN ' ' || NEW.temperature_c::text || '°C' ELSE '' END
        || ' (ตรวจพบอัตโนมัติที่จุดคัดกรอง Smart Gate)',
      NULL, 'ระบบคัดกรองอัตโนมัติ', true
    );
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_smart_gate_fever_health ON public.smart_gate_events;
CREATE TRIGGER trg_smart_gate_fever_health
AFTER INSERT ON public.smart_gate_events
FOR EACH ROW EXECUTE FUNCTION public.smart_gate_fever_health_record();