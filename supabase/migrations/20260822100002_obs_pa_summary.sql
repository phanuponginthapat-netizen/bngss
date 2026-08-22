-- Obs → PA: summary view รวมคะแนนสังเกตการสอนต่อครู (safe if tables not yet migrated)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='observation_sessions')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='observation_records') THEN
    EXECUTE '
      CREATE OR REPLACE VIEW public.teacher_observation_summary AS
      SELECT
        s.teacher_id,
        COUNT(DISTINCT s.id) AS session_count,
        COUNT(r.id) AS record_count,
        ROUND(AVG(r.total_score)::numeric, 2) AS avg_score,
        ROUND(AVG(CASE WHEN r.max_score > 0 THEN (r.total_score / r.max_score * 100) ELSE NULL END)::numeric, 1) AS avg_percent,
        MAX(r.observed_at) AS last_observed_at
      FROM public.observation_sessions s
      LEFT JOIN public.observation_records r ON r.session_id = s.id AND r.status = ''submitted''
      WHERE s.status = ''completed''
      GROUP BY s.teacher_id
    ';
    EXECUTE '
      CREATE OR REPLACE FUNCTION public.get_teacher_observation_score(_teacher_id uuid)
      RETURNS TABLE(avg_percent numeric, session_count bigint, last_observed_at timestamptz) AS $f$
        SELECT avg_percent, session_count, last_observed_at
        FROM public.teacher_observation_summary
        WHERE teacher_id = _teacher_id;
      $f$ LANGUAGE sql STABLE SECURITY DEFINER
    ';
    EXECUTE 'GRANT SELECT ON public.teacher_observation_summary TO authenticated';
  END IF;
END $$;
