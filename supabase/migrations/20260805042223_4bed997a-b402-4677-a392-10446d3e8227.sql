DO $$
DECLARE j record;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    FOR j IN SELECT jobname FROM cron.job LOOP
      PERFORM cron.unschedule(j.jobname);
    END LOOP;
  END IF;
END $$;