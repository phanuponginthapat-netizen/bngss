-- Leave balance tracking table
CREATE TABLE IF NOT EXISTS public.leave_balances (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  year integer NOT NULL DEFAULT EXTRACT(YEAR FROM now()),
  leave_type text NOT NULL, -- 'sick', 'personal', 'vacation', 'maternity', 'training'
  total_days numeric DEFAULT 0,
  used_days numeric DEFAULT 0,
  remaining_days numeric GENERATED ALWAYS AS (total_days - used_days) STORED,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, year, leave_type)
);

ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own leave balances" ON public.leave_balances FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage leave balances" ON public.leave_balances FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Auto-calculate sick leave balance per Thai labor law (30 days/year paid)
-- Personal leave: 3 days/year, Vacation: based on years of service
CREATE OR REPLACE FUNCTION public.calculate_leave_balances(_year integer)
RETURNS void AS $$
DECLARE
  r RECORD;
  svc_years integer;
  vac_days numeric;
BEGIN
  FOR r IN 
    SELECT u.id, u.created_at
    FROM auth.users u
    JOIN public.user_roles ur ON ur.user_id = u.id
    WHERE ur.role IN ('teacher', 'director', 'admin')
  LOOP
    svc_years := EXTRACT(YEAR FROM age(now(), r.created_at));
    
    -- Sick leave: 30 days/year (paid)
    INSERT INTO public.leave_balances (user_id, year, leave_type, total_days)
    VALUES (r.id, _year, 'sick', 30)
    ON CONFLICT (user_id, year, leave_type) DO NOTHING;
    
    -- Personal leave: 3 days/year
    INSERT INTO public.leave_balances (user_id, year, leave_type, total_days)
    VALUES (r.id, _year, 'personal', 3)
    ON CONFLICT (user_id, year, leave_type) DO NOTHING;
    
    -- Vacation: 6 days (0-5 years), 7-12 days (6-10 years), 10-15 days (10+ years) per Thai law
    IF svc_years < 6 THEN vac_days := 6;
    ELSIF svc_years < 10 THEN vac_days := 7 + (svc_years - 6);
    ELSE vac_days := 15;
    END IF;
    
    INSERT INTO public.leave_balances (user_id, year, leave_type, total_days)
    VALUES (r.id, _year, 'vacation', LEAST(vac_days, 15))
    ON CONFLICT (user_id, year, leave_type) DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Auto-update used_days from staff_leave records
CREATE OR REPLACE FUNCTION public.update_leave_used_days()
RETURNS trigger AS $$
BEGIN
  UPDATE public.leave_balances lb
  SET used_days = (
    SELECT COALESCE(SUM(sl.days_requested), 0)
    FROM public.staff_leave sl
    WHERE sl.user_id = lb.user_id
      AND sl.status = 'approved'
      AND sl.leave_type = lb.leave_type
      AND EXTRACT(YEAR FROM sl.start_date) = lb.year
  ),
  updated_at = now()
  WHERE lb.user_id = COALESCE(NEW.user_id, OLD.user_id)
    AND lb.year = EXTRACT(YEAR FROM COALESCE(NEW.start_date, OLD.start_date))::integer;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_leave_used ON public.staff_leave;
CREATE TRIGGER trg_update_leave_used
  AFTER INSERT OR UPDATE OR DELETE ON public.staff_leave
  FOR EACH ROW
  EXECUTE FUNCTION public.update_leave_used_days();
