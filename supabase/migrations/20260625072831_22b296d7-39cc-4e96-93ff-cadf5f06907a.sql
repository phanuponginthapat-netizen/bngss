
CREATE TABLE public.academic_periods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  academic_year_be INT NOT NULL,
  semester SMALLINT NOT NULL CHECK (semester IN (1,2)),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  midterm_date DATE,
  final_date DATE,
  is_current BOOLEAN NOT NULL DEFAULT false,
  is_closed BOOLEAN NOT NULL DEFAULT false,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (academic_year_be, semester)
);

GRANT SELECT ON public.academic_periods TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.academic_periods TO authenticated;
GRANT ALL ON public.academic_periods TO service_role;

ALTER TABLE public.academic_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view academic periods"
  ON public.academic_periods FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin/Director can insert academic periods"
  ON public.academic_periods FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

CREATE POLICY "Admin/Director can update academic periods"
  ON public.academic_periods FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

CREATE POLICY "Admin/Director can delete academic periods"
  ON public.academic_periods FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

CREATE TRIGGER trg_academic_periods_updated_at
  BEFORE UPDATE ON public.academic_periods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ensure only one row has is_current = true
CREATE OR REPLACE FUNCTION public.enforce_single_current_period()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.is_current = true THEN
    UPDATE public.academic_periods SET is_current = false WHERE id <> NEW.id AND is_current = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_academic_periods_single_current
  AFTER INSERT OR UPDATE OF is_current ON public.academic_periods
  FOR EACH ROW WHEN (NEW.is_current = true)
  EXECUTE FUNCTION public.enforce_single_current_period();

-- Seed default periods for current academic year 2569 (CE 2026)
INSERT INTO public.academic_periods (academic_year_be, semester, start_date, end_date, is_current) VALUES
  (2569, 1, '2026-05-16', '2026-10-10', true),
  (2569, 2, '2026-11-01', '2027-03-31', false)
ON CONFLICT (academic_year_be, semester) DO NOTHING;

-- Enable realtime
ALTER TABLE public.academic_periods REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.academic_periods;
