
-- ============== Hub Projects ==============
CREATE TABLE IF NOT EXISTS public.hub_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  hub_project_code TEXT,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  fiscal_year INT NOT NULL DEFAULT EXTRACT(year FROM now())::int,
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning','active','paused','completed','cancelled')),
  responsible_person TEXT,
  responsible_user_id UUID,
  start_date DATE,
  end_date DATE,
  budget_received NUMERIC(14,2) NOT NULL DEFAULT 0,
  budget_spent NUMERIC(14,2) NOT NULL DEFAULT 0,
  target_beneficiaries INT,
  goals TEXT,
  cover_image_url TEXT,
  feed_to_hub BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_projects TO authenticated;
GRANT ALL ON public.hub_projects TO service_role;
GRANT SELECT ON public.hub_projects TO anon;
ALTER TABLE public.hub_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view projects in school" ON public.hub_projects FOR SELECT TO authenticated
  USING (school_id IS NULL OR school_id = public.get_user_school_id(auth.uid())
    OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));
CREATE POLICY "staff manage projects" ON public.hub_projects FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'));

CREATE INDEX IF NOT EXISTS idx_hub_projects_school ON public.hub_projects(school_id, fiscal_year);
CREATE TRIGGER trg_hub_projects_updated BEFORE UPDATE ON public.hub_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto fill school_id
CREATE OR REPLACE FUNCTION public.hub_project_fill_school() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.school_id IS NULL AND NEW.created_by IS NOT NULL THEN
    SELECT school_id INTO NEW.school_id FROM public.profiles WHERE id = NEW.created_by LIMIT 1;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_hub_project_fill_school BEFORE INSERT ON public.hub_projects
  FOR EACH ROW EXECUTE FUNCTION public.hub_project_fill_school();

-- ============== Budgets received ==============
CREATE TABLE IF NOT EXISTS public.hub_project_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.hub_projects(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  received_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source TEXT,
  reference_no TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_project_budgets TO authenticated;
GRANT ALL ON public.hub_project_budgets TO service_role;
ALTER TABLE public.hub_project_budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view budgets via project" ON public.hub_project_budgets FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.hub_projects p WHERE p.id = project_id));
CREATE POLICY "staff manage budgets" ON public.hub_project_budgets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'));

-- ============== Expenses ==============
CREATE TABLE IF NOT EXISTS public.hub_project_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.hub_projects(id) ON DELETE CASCADE,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT,
  description TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  receipt_no TEXT,
  receipt_url TEXT,
  vendor TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_project_expenses TO authenticated;
GRANT ALL ON public.hub_project_expenses TO service_role;
ALTER TABLE public.hub_project_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view expenses via project" ON public.hub_project_expenses FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.hub_projects p WHERE p.id = project_id));
CREATE POLICY "staff manage expenses" ON public.hub_project_expenses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'));

-- ============== Progress updates (feed) ==============
CREATE TABLE IF NOT EXISTS public.hub_project_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.hub_projects(id) ON DELETE CASCADE,
  update_date DATE NOT NULL DEFAULT CURRENT_DATE,
  period_label TEXT,
  title TEXT NOT NULL,
  summary TEXT,
  details TEXT,
  photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  participants_count INT,
  progress_percent INT CHECK (progress_percent BETWEEN 0 AND 100),
  is_published BOOLEAN NOT NULL DEFAULT true,
  feed_to_hub BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_project_updates TO authenticated;
GRANT ALL ON public.hub_project_updates TO service_role;
GRANT SELECT ON public.hub_project_updates TO anon;
ALTER TABLE public.hub_project_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view updates via project" ON public.hub_project_updates FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.hub_projects p WHERE p.id = project_id));
CREATE POLICY "anon view published updates" ON public.hub_project_updates FOR SELECT TO anon
  USING (is_published = true);
CREATE POLICY "staff manage updates" ON public.hub_project_updates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'));
CREATE TRIGGER trg_hub_project_updates_updated BEFORE UPDATE ON public.hub_project_updates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============== Auto-recompute budget totals ==============
CREATE OR REPLACE FUNCTION public.recompute_hub_project_totals() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pid uuid;
BEGIN
  pid := COALESCE(NEW.project_id, OLD.project_id);
  UPDATE public.hub_projects p SET
    budget_received = COALESCE((SELECT SUM(amount) FROM public.hub_project_budgets WHERE project_id = pid),0),
    budget_spent    = COALESCE((SELECT SUM(amount) FROM public.hub_project_expenses WHERE project_id = pid),0),
    updated_at = now()
  WHERE p.id = pid;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_recompute_on_budget AFTER INSERT OR UPDATE OR DELETE ON public.hub_project_budgets
  FOR EACH ROW EXECUTE FUNCTION public.recompute_hub_project_totals();
CREATE TRIGGER trg_recompute_on_expense AFTER INSERT OR UPDATE OR DELETE ON public.hub_project_expenses
  FOR EACH ROW EXECUTE FUNCTION public.recompute_hub_project_totals();

-- Add to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.hub_projects, public.hub_project_budgets, public.hub_project_expenses, public.hub_project_updates;
