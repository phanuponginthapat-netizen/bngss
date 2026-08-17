-- Remove highly sensitive tables from realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.ai_chat_logs;
ALTER PUBLICATION supabase_realtime DROP TABLE public.ai_user_memory;
ALTER PUBLICATION supabase_realtime DROP TABLE public.profiles;
ALTER PUBLICATION supabase_realtime DROP TABLE public.students;
ALTER PUBLICATION supabase_realtime DROP TABLE public.user_roles;
ALTER PUBLICATION supabase_realtime DROP TABLE public.time_clock;
ALTER PUBLICATION supabase_realtime DROP TABLE public.staff_leaves;
ALTER PUBLICATION supabase_realtime DROP TABLE public.student_leaves;
ALTER PUBLICATION supabase_realtime DROP TABLE public.student_scores;
ALTER PUBLICATION supabase_realtime DROP TABLE public.student_assessment_scores;
ALTER PUBLICATION supabase_realtime DROP TABLE public.student_column_scores;
ALTER PUBLICATION supabase_realtime DROP TABLE public.personnel;
-- Lock down ai_providers.api_key from Data API access
DO $guard$
BEGIN
  EXECUTE 'REVOKE SELECT (api_key) ON public.ai_providers FROM anon, authenticated';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
