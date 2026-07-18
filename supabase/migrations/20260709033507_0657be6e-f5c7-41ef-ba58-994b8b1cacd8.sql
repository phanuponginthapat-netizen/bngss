
-- Part 1.1: เติม school_id ลงตารางหลักที่ยังไม่มี + backfill + trigger auto-fill
-- Single-school: default = โรงเรียนบ้านหนองเงือก

DO $$
DECLARE
  default_school uuid;
BEGIN
  SELECT id INTO default_school FROM public.schools WHERE is_active = true ORDER BY created_at LIMIT 1;
  IF default_school IS NULL THEN
    RAISE EXCEPTION 'No active school found';
  END IF;

  -- hub_project_budgets
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='hub_project_budgets' AND column_name='school_id') THEN
    ALTER TABLE public.hub_project_budgets ADD COLUMN school_id uuid REFERENCES public.schools(id);
    EXECUTE format('UPDATE public.hub_project_budgets SET school_id = %L WHERE school_id IS NULL', default_school);
    CREATE INDEX IF NOT EXISTS idx_hub_project_budgets_school ON public.hub_project_budgets(school_id);
  END IF;

  -- hub_project_expenses
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='hub_project_expenses' AND column_name='school_id') THEN
    ALTER TABLE public.hub_project_expenses ADD COLUMN school_id uuid REFERENCES public.schools(id);
    EXECUTE format('UPDATE public.hub_project_expenses SET school_id = %L WHERE school_id IS NULL', default_school);
    CREATE INDEX IF NOT EXISTS idx_hub_project_expenses_school ON public.hub_project_expenses(school_id);
  END IF;

  -- hub_project_updates
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='hub_project_updates' AND column_name='school_id') THEN
    ALTER TABLE public.hub_project_updates ADD COLUMN school_id uuid REFERENCES public.schools(id);
    EXECUTE format('UPDATE public.hub_project_updates SET school_id = %L WHERE school_id IS NULL', default_school);
    CREATE INDEX IF NOT EXISTS idx_hub_project_updates_school ON public.hub_project_updates(school_id);
  END IF;

  -- student_leaves
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='student_leaves' AND column_name='school_id') THEN
    ALTER TABLE public.student_leaves ADD COLUMN school_id uuid REFERENCES public.schools(id);
    EXECUTE format('UPDATE public.student_leaves SET school_id = %L WHERE school_id IS NULL', default_school);
    CREATE INDEX IF NOT EXISTS idx_student_leaves_school ON public.student_leaves(school_id);
  END IF;

  -- Backfill NULL rows in tables that already have school_id
  EXECUTE format('UPDATE public.students SET school_id = %L WHERE school_id IS NULL', default_school);
  EXECUTE format('UPDATE public.personnel SET school_id = %L WHERE school_id IS NULL', default_school);
  EXECUTE format('UPDATE public.classrooms SET school_id = %L WHERE school_id IS NULL', default_school);
  EXECUTE format('UPDATE public.enrollments SET school_id = %L WHERE school_id IS NULL', default_school);
  EXECUTE format('UPDATE public.attendance SET school_id = %L WHERE school_id IS NULL', default_school);
  EXECUTE format('UPDATE public.behavior_records SET school_id = %L WHERE school_id IS NULL', default_school);
  EXECUTE format('UPDATE public.news_posts SET school_id = %L WHERE school_id IS NULL', default_school);
  EXECUTE format('UPDATE public.academic_events SET school_id = %L WHERE school_id IS NULL', default_school);
  EXECUTE format('UPDATE public.documents SET school_id = %L WHERE school_id IS NULL', default_school);
  EXECUTE format('UPDATE public.hub_projects SET school_id = %L WHERE school_id IS NULL', default_school);
  EXECUTE format('UPDATE public.school_test_scores SET school_id = %L WHERE school_id IS NULL', default_school);
  EXECUTE format('UPDATE public.action_plans SET school_id = %L WHERE school_id IS NULL', default_school);
  EXECUTE format('UPDATE public.assets SET school_id = %L WHERE school_id IS NULL', default_school);
  EXECUTE format('UPDATE public.budget_transactions SET school_id = %L WHERE school_id IS NULL', default_school);
END $$;

-- Auto-fill trigger: set school_id from profile if missing on insert
CREATE OR REPLACE FUNCTION public.auto_set_school_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s uuid;
BEGIN
  IF NEW.school_id IS NULL THEN
    SELECT school_id INTO s FROM public.profiles WHERE id = auth.uid();
    IF s IS NULL THEN
      SELECT id INTO s FROM public.schools WHERE is_active = true ORDER BY created_at LIMIT 1;
    END IF;
    NEW.school_id := s;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'students','personnel','classrooms','enrollments','attendance','behavior_records',
    'student_leaves','news_posts','academic_events','documents','hub_projects',
    'hub_project_budgets','hub_project_expenses','hub_project_updates',
    'school_test_scores','action_plans','assets','budget_transactions'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_auto_school_id ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_auto_school_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.auto_set_school_id()', t);
  END LOOP;
END $$;

-- Table: hub_push_log — record of pushes to central Hub
CREATE TABLE IF NOT EXISTS public.hub_push_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id),
  hub_url text NOT NULL,
  status text NOT NULL,
  http_status int,
  payload_bytes int,
  tables_pushed jsonb,
  error text,
  duration_ms int,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.hub_push_log TO authenticated;
GRANT ALL ON public.hub_push_log TO service_role;

ALTER TABLE public.hub_push_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view hub push log" ON public.hub_push_log;
CREATE POLICY "Admins view hub push log" ON public.hub_push_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

CREATE INDEX IF NOT EXISTS idx_hub_push_log_created ON public.hub_push_log(created_at DESC);
