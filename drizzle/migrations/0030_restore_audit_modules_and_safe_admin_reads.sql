CREATE TABLE IF NOT EXISTS public.observer_tokens (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), token text NOT NULL UNIQUE, observer_name text NOT NULL, observer_role text NOT NULL DEFAULT 'ศึกษานิเทศก์', created_by uuid, expires_at timestamptz NOT NULL, max_uses integer NOT NULL DEFAULT 1 CHECK(max_uses>0), use_count integer NOT NULL DEFAULT 0 CHECK(use_count>=0), is_active boolean NOT NULL DEFAULT true, note text, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.observer_tokens TO authenticated;
GRANT ALL ON public.observer_tokens TO service_role;
ALTER TABLE public.observer_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_observer_admin ON public.observer_tokens FOR ALL TO authenticated USING(public.has_role(auth.uid(),'admin')) WITH CHECK(public.has_role(auth.uid(),'admin'));
CREATE TABLE IF NOT EXISTS public.observation_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), teacher_id uuid NOT NULL REFERENCES public.personnel(id), teacher_name text, classroom text NOT NULL, subject text NOT NULL, observation_date date NOT NULL, scheduled_date date NOT NULL, status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','scheduled','in_progress','completed','cancelled')), observer_name text, observer_token_id uuid REFERENCES public.observer_tokens(id), notes text, created_by uuid DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.observation_sessions TO authenticated;
GRANT ALL ON public.observation_sessions TO service_role;
ALTER TABLE public.observation_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_observation_session_read ON public.observation_sessions FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR EXISTS(SELECT 1 FROM public.personnel p WHERE p.id=teacher_id AND p.user_id=auth.uid()));
CREATE POLICY audit_observation_session_manage ON public.observation_sessions FOR ALL TO authenticated USING(public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director')) WITH CHECK(public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));
CREATE TABLE IF NOT EXISTS public.observation_records (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), session_id uuid NOT NULL UNIQUE REFERENCES public.observation_sessions(id), scores jsonb NOT NULL DEFAULT '{}', comments jsonb NOT NULL DEFAULT '{}', overall_comment text, strengths text, suggestions text, total_score numeric NOT NULL DEFAULT 0, max_score numeric NOT NULL DEFAULT 40 CHECK(max_score>0), percentage numeric NOT NULL DEFAULT 0, is_draft boolean NOT NULL DEFAULT true, submitted_by uuid DEFAULT auth.uid(), submitted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), CHECK(total_score>=0 AND total_score<=max_score), CHECK(percentage>=0 AND percentage<=100)
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.observation_records TO authenticated;
GRANT ALL ON public.observation_records TO service_role;
ALTER TABLE public.observation_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_observation_record_read ON public.observation_records FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.observation_sessions s WHERE s.id=session_id));
CREATE POLICY audit_observation_record_manage ON public.observation_records FOR ALL TO authenticated USING(public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director')) WITH CHECK(public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));
CREATE TABLE IF NOT EXISTS public.early_warnings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), student_id uuid NOT NULL REFERENCES public.students(id), risk_level text NOT NULL CHECK(risk_level IN ('low','medium','high')), reasons jsonb NOT NULL DEFAULT '[]', score integer NOT NULL DEFAULT 0, details jsonb NOT NULL DEFAULT '{}', calculated_at timestamptz NOT NULL DEFAULT now(), notified boolean NOT NULL DEFAULT false, notified_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.early_warnings TO authenticated;
GRANT ALL ON public.early_warnings TO service_role;
ALTER TABLE public.early_warnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_early_warning_staff ON public.early_warnings FOR ALL TO authenticated USING(public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher')) WITH CHECK(public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'));
CREATE INDEX IF NOT EXISTS audit_early_warning_student_date ON public.early_warnings(student_id,calculated_at DESC);
DROP POLICY IF EXISTS "Homeroom teachers can view their students' chat logs" ON public.ai_chat_logs;
REVOKE ALL ON FUNCTION public.get_db_schema() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_db_schema() TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.get_cloud_usage_summary() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_cloud_usage_summary() TO authenticated,service_role;