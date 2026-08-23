CREATE OR REPLACE FUNCTION public.get_trend_analytics()
RETURNS TABLE(academic_year int, subject text, avg_score numeric, student_count bigint) AS $$
  SELECT subj.academic_year::int, subj.name_th::text, ROUND(AVG(ss.total_score)::numeric,2) as avg_score, COUNT(*)::bigint as student_count
  FROM public.student_scores ss
  JOIN public.subjects subj ON ss.subject_id = subj.id
  WHERE ss.total_score IS NOT NULL AND subj.academic_year IS NOT NULL
  GROUP BY subj.academic_year, subj.name_th
  ORDER BY subj.academic_year, subj.name_th;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION public.get_trend_analytics() TO authenticated, anon;
