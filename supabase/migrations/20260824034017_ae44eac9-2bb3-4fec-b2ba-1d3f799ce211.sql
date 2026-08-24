DELETE FROM public.time_clock t
 USING (
   SELECT id,
          row_number() OVER (PARTITION BY personnel_id, clock_date ORDER BY clock_in NULLS LAST, id) AS rn
     FROM public.time_clock
    WHERE personnel_id IS NOT NULL AND clock_date IS NOT NULL
 ) d
 WHERE t.id = d.id AND d.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS time_clock_personnel_date_uidx
  ON public.time_clock (personnel_id, clock_date);