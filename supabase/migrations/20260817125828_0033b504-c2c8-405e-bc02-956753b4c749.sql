CREATE UNIQUE INDEX IF NOT EXISTS time_clock_personnel_date_uidx
  ON public.time_clock (personnel_id, clock_date)
  WHERE personnel_id IS NOT NULL;

DROP FUNCTION IF EXISTS public.kiosk_clock_personnel(uuid, text, text, real) CASCADE;

CREATE OR REPLACE FUNCTION public.kiosk_clock_personnel(
  _personnel_id uuid,
  _mode text DEFAULT 'entry',
  _photo_url text DEFAULT NULL,
  _confidence real DEFAULT NULL
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
  _note text := 'Face kiosk' || CASE WHEN _confidence IS NOT NULL THEN ' (' || round((_confidence*100)::numeric, 1) || '%)' ELSE '' END;
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
           notes = COALESCE(notes, '') || CASE WHEN notes IS NULL THEN _note ELSE ' | ' || _note END
     WHERE id = _row.id
     RETURNING * INTO _row;
    RETURN jsonb_build_object('ok', true, 'action', 'clock_out', 'clock_out', _row.clock_out);
  END IF;

  IF _row.id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'duplicate', 'clock_in', _row.clock_in);
  END IF;

  INSERT INTO public.time_clock (personnel_id, clock_date, clock_in, status, notes, clock_in_photo_url)
  VALUES (
    _personnel_id, _today, _now,
    CASE WHEN (_now AT TIME ZONE 'Asia/Bangkok')::time > time '08:30' THEN 'late' ELSE 'normal' END,
    _note, _photo_url
  )
  ON CONFLICT (personnel_id, clock_date) DO NOTHING
  RETURNING * INTO _row;

  IF _row.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'duplicate');
  END IF;

  RETURN jsonb_build_object('ok', true, 'action', 'clock_in', 'clock_in', _row.clock_in, 'status', _row.status);
END;
$fn$;

REVOKE ALL ON FUNCTION public.kiosk_clock_personnel(uuid, text, text, real) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kiosk_clock_personnel(uuid, text, text, real) TO authenticated, service_role;