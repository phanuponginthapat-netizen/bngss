CREATE OR REPLACE FUNCTION public.export_cron_jobs()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, cron, extensions
AS $$
DECLARE
  _out jsonb := '[]'::jsonb;
BEGIN
  IF to_regclass('cron.job') IS NULL THEN
    RETURN jsonb_build_object('available', false, 'jobs', '[]'::jsonb);
  END IF;
  EXECUTE $q$
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'jobname', jobname,
      'schedule', schedule,
      'command', command,
      'nodename', nodename,
      'nodeport', nodeport,
      'database', database,
      'username', username,
      'active', active
    ) ORDER BY jobname), '[]'::jsonb)
    FROM cron.job
  $q$ INTO _out;
  RETURN jsonb_build_object('available', true, 'jobs', _out);
END;
$$;

REVOKE ALL ON FUNCTION public.export_cron_jobs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.export_cron_jobs() TO service_role;

CREATE OR REPLACE FUNCTION public.import_cron_jobs(_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, extensions
AS $$
DECLARE
  _job jsonb;
  _n int := 0;
  _errors jsonb := '[]'::jsonb;
BEGIN
  IF to_regclass('cron.job') IS NULL THEN
    RETURN jsonb_build_object('applied', 0, 'skipped', 'pg_cron not installed');
  END IF;
  FOR _job IN SELECT * FROM jsonb_array_elements(coalesce(_payload->'jobs', '[]'::jsonb))
  LOOP
    BEGIN
      PERFORM cron.unschedule(_job->>'jobname');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      PERFORM cron.schedule(_job->>'jobname', _job->>'schedule', _job->>'command');
      _n := _n + 1;
    EXCEPTION WHEN OTHERS THEN
      _errors := _errors || jsonb_build_object('jobname', _job->>'jobname', 'error', SQLERRM);
    END;
  END LOOP;
  RETURN jsonb_build_object('applied', _n, 'errors', _errors);
END;
$$;

REVOKE ALL ON FUNCTION public.import_cron_jobs(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_cron_jobs(jsonb) TO service_role;