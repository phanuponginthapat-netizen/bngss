-- 1) De-duplicate existing rows per (personnel_id, clock_date)
WITH ranked AS (
  SELECT id, personnel_id, clock_date,
         row_number() OVER (PARTITION BY personnel_id, clock_date ORDER BY clock_in NULLS LAST, created_at NULLS LAST, id) AS rn
  FROM public.time_clock
  WHERE personnel_id IS NOT NULL AND clock_date IS NOT NULL
), keep AS (
  SELECT personnel_id, clock_date, id AS keep_id FROM ranked WHERE rn = 1
), agg AS (
  SELECT t.personnel_id, t.clock_date, max(t.clock_out) AS max_out
  FROM public.time_clock t
  WHERE t.personnel_id IS NOT NULL AND t.clock_date IS NOT NULL
  GROUP BY 1,2
)
UPDATE public.time_clock tc
   SET clock_out = COALESCE(tc.clock_out, agg.max_out)
  FROM keep JOIN agg ON agg.personnel_id = keep.personnel_id AND agg.clock_date = keep.clock_date
 WHERE tc.id = keep.keep_id;

DELETE FROM public.time_clock tc
USING (
  SELECT id, row_number() OVER (PARTITION BY personnel_id, clock_date ORDER BY clock_in NULLS LAST, created_at NULLS LAST, id) AS rn
  FROM public.time_clock
  WHERE personnel_id IS NOT NULL AND clock_date IS NOT NULL
) d
WHERE tc.id = d.id AND d.rn > 1;

-- 2) The constraint the kiosk RPC expects
CREATE UNIQUE INDEX IF NOT EXISTS time_clock_personnel_date_uidx
  ON public.time_clock (personnel_id, clock_date);

-- 3) Make the RPC resilient even if the index is missing
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
   ORDER BY clock_in NULLS LAST
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

  BEGIN
    INSERT INTO public.time_clock (personnel_id, clock_date, clock_in, status, notes, clock_in_photo_url, temperature_c)
    VALUES (
      _personnel_id, _today, _now,
      CASE WHEN (_now AT TIME ZONE 'Asia/Bangkok')::time > time '08:30' THEN 'late' ELSE 'normal' END,
      _note, _photo_url, _temperature_c
    )
    RETURNING * INTO _row;
  EXCEPTION WHEN unique_violation THEN
    SELECT * INTO _row FROM public.time_clock
     WHERE personnel_id = _personnel_id AND clock_date = _today LIMIT 1;
    RETURN jsonb_build_object('ok', false, 'reason', 'duplicate', 'clock_in', _row.clock_in);
  END;

  RETURN jsonb_build_object('ok', true, 'action', 'clock_in', 'clock_in', _row.clock_in, 'status', _row.status);
END;
$fn$;

REVOKE ALL ON FUNCTION public.kiosk_clock_personnel(uuid, text, text, real, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kiosk_clock_personnel(uuid, text, text, real, numeric) TO authenticated, service_role;