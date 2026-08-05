DO $$
DECLARE s text; n int;
BEGIN
  s := public.export_extras_sql();
  n := (SELECT count(*) FROM regexp_matches(s, 'supabase_realtime ADD TABLE', 'g'));
  RAISE NOTICE 'extras length=% realtime_lines=%', length(s), n;
  IF n < 60 THEN RAISE EXCEPTION 'realtime export incomplete: %', n; END IF;
END $$;