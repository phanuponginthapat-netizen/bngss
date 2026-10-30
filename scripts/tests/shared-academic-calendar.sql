-- Integration test: run ONLY against a disposable PostgreSQL database.
\set ON_ERROR_STOP on
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.user_id',true),'')::uuid $$;
CREATE TABLE public.user_roles(user_id uuid,role text);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
CREATE FUNCTION public.has_role(_uid uuid,_role text) RETURNS boolean LANGUAGE sql AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_uid AND role=_role) $$;
CREATE TABLE public.academic_periods(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), academic_year_be integer NOT NULL,semester smallint NOT NULL,start_date date NOT NULL,end_date date NOT NULL,is_current boolean NOT NULL DEFAULT false,UNIQUE(academic_year_be,semester));
GRANT SELECT ON public.academic_periods TO authenticated;
GRANT ALL ON public.academic_periods TO service_role;
CREATE TABLE public.school_settings(setting_key text PRIMARY KEY,setting_value text);
GRANT SELECT ON public.school_settings TO authenticated;
GRANT ALL ON public.school_settings TO service_role;
CREATE TABLE public.attendance(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),attendance_date date NOT NULL,academic_year integer,semester integer,notes text);
GRANT SELECT,INSERT ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
CREATE FUNCTION public.enforce_single_current_period() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.is_current THEN UPDATE public.academic_periods SET is_current=false WHERE id<>NEW.id AND is_current; END IF; RETURN NEW; END $$;
CREATE TRIGGER single_current AFTER INSERT OR UPDATE OF is_current ON public.academic_periods FOR EACH ROW WHEN(NEW.is_current) EXECUTE FUNCTION public.enforce_single_current_period();
INSERT INTO public.user_roles VALUES('00000000-0000-0000-0000-000000000001','admin');
INSERT INTO public.academic_periods(academic_year_be,semester,start_date,end_date) VALUES(2569,1,'2026-05-16','2026-10-10'),(2569,2,'2026-11-02','2027-03-31');
INSERT INTO public.attendance(attendance_date,academic_year,semester,notes) VALUES('2026-09-01',2026,1,'historical');
\ir ../../supabase/migrations/20261030110000_shared_academic_calendar.sql
-- Re-applying must also succeed.
\ir ../../supabase/migrations/20261030110000_shared_academic_calendar.sql
DO $$ BEGIN
 IF (SELECT semester FROM public.resolve_school_term('2026-11-01'))<>1 THEN RAISE EXCEPTION 'term switched before 2 November'; END IF;
 IF (SELECT semester FROM public.resolve_school_term('2026-11-02'))<>2 THEN RAISE EXCEPTION '2 November must be term 2'; END IF;
 BEGIN
  PERFORM public.save_academic_period_dates(2569,'[{"semester":1,"start_date":"2026-05-16","end_date":"2026-10-10"},{"semester":2,"start_date":"2026-11-02","end_date":"2027-03-31"}]');
  RAISE EXCEPTION 'anonymous save was allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('test.user_id','00000000-0000-0000-0000-000000000001',false);
SELECT public.save_academic_period_dates(2569,'[{"semester":1,"start_date":"2026-05-16","end_date":"2026-10-10"},{"semester":2,"start_date":"2026-11-02","end_date":"2027-03-31"}]');
DO $$ BEGIN
 BEGIN
  PERFORM public.save_academic_period_dates(2569,'[{"semester":1,"start_date":"2026-05-16","end_date":"2026-11-03"},{"semester":2,"start_date":"2026-11-02","end_date":"2027-03-31"}]');
  RAISE EXCEPTION 'TEST: overlap allowed';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'TEST:%' THEN RAISE; END IF; END;
 IF (SELECT end_date FROM public.academic_periods WHERE semester=1)<>'2026-10-10'::date THEN RAISE EXCEPTION 'failed save partially changed dates'; END IF;
END $$;
INSERT INTO public.school_settings VALUES('academic_year_override','2569'),('semester_override','2');
SELECT public.auto_period_maintenance();
DO $$ BEGIN
 IF (SELECT semester FROM public.academic_periods WHERE is_current)<>2 THEN RAISE EXCEPTION 'maintenance ignored manual override'; END IF;
END $$;
DELETE FROM public.school_settings;
INSERT INTO public.attendance(attendance_date,academic_year,semester,notes) VALUES('2026-11-02',2026,1,'face-scan'),('2026-11-02',2025,2,'manual');
DO $$ BEGIN
 IF (SELECT semester FROM public.attendance WHERE notes='face-scan')<>2 THEN RAISE EXCEPTION 'scan used wrong term'; END IF;
 IF (SELECT academic_year FROM public.attendance WHERE notes='manual')<>2025 THEN RAISE EXCEPTION 'explicit manual term changed'; END IF;
 IF (SELECT semester FROM public.attendance WHERE notes='historical')<>1 THEN RAISE EXCEPTION 'historical attendance changed'; END IF;
 IF has_function_privilege('anon','public.save_academic_period_dates(integer,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'anonymous RPC access'; END IF;
END $$;
SELECT 'All calendar integration assertions passed' AS result;