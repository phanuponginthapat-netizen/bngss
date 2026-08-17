
-- 1. Duty locations
CREATE TABLE IF NOT EXISTS public.duty_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  order_index INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  school_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.duty_locations TO authenticated;
GRANT ALL ON public.duty_locations TO service_role;
ALTER TABLE public.duty_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "duty_locations_select_auth" ON public.duty_locations;
CREATE POLICY "duty_locations_select_auth" ON public.duty_locations
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "duty_locations_admin_write" ON public.duty_locations;
CREATE POLICY "duty_locations_admin_write" ON public.duty_locations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'director'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'director'));

-- 2. Duty assignments
CREATE TABLE IF NOT EXISTS public.duty_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES public.duty_locations(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.personnel(id) ON DELETE CASCADE,
  duty_date DATE,                       -- specific date; null => weekly recurring
  day_of_week INT CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=Sun..6=Sat when recurring
  start_time TIME,
  end_time TIME,
  role_label TEXT,                      -- เช่น หัวหน้าเวร / ผู้ช่วย
  notes TEXT,
  school_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (duty_date IS NOT NULL OR day_of_week IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_duty_assign_date ON public.duty_assignments(duty_date);
CREATE INDEX IF NOT EXISTS idx_duty_assign_dow ON public.duty_assignments(day_of_week);
CREATE INDEX IF NOT EXISTS idx_duty_assign_teacher ON public.duty_assignments(teacher_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.duty_assignments TO authenticated;
GRANT ALL ON public.duty_assignments TO service_role;
ALTER TABLE public.duty_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "duty_assign_select_auth" ON public.duty_assignments;
CREATE POLICY "duty_assign_select_auth" ON public.duty_assignments
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "duty_assign_admin_write" ON public.duty_assignments;
CREATE POLICY "duty_assign_admin_write" ON public.duty_assignments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'director'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'director'));

-- 3. Duty logs (incident/report per shift)
CREATE TABLE IF NOT EXISTS public.duty_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES public.duty_assignments(id) ON DELETE SET NULL,
  location_id UUID REFERENCES public.duty_locations(id) ON DELETE SET NULL,
  teacher_id UUID REFERENCES public.personnel(id) ON DELETE SET NULL,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  log_time TIME NOT NULL DEFAULT CURRENT_TIME,
  category TEXT,                        -- เหตุการณ์ / ปกติ / ข้อเสนอแนะ
  title TEXT,
  content TEXT NOT NULL,
  attachments JSONB DEFAULT '[]'::jsonb,
  reported_by UUID,                     -- auth.uid()
  school_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_duty_logs_date ON public.duty_logs(log_date);
CREATE INDEX IF NOT EXISTS idx_duty_logs_teacher ON public.duty_logs(teacher_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.duty_logs TO authenticated;
GRANT ALL ON public.duty_logs TO service_role;
ALTER TABLE public.duty_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "duty_logs_select_auth" ON public.duty_logs;
CREATE POLICY "duty_logs_select_auth" ON public.duty_logs
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "duty_logs_insert_self_or_admin" ON public.duty_logs;
CREATE POLICY "duty_logs_insert_self_or_admin" ON public.duty_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    reported_by = auth.uid()
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'director')
  );
DROP POLICY IF EXISTS "duty_logs_update_owner_or_admin" ON public.duty_logs;
CREATE POLICY "duty_logs_update_owner_or_admin" ON public.duty_logs
  FOR UPDATE TO authenticated
  USING (
    reported_by = auth.uid()
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'super_admin')
    OR public.has_role(auth.uid(),'director')
  );
DROP POLICY IF EXISTS "duty_logs_delete_admin" ON public.duty_logs;
CREATE POLICY "duty_logs_delete_admin" ON public.duty_logs
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin') OR public.has_role(auth.uid(),'director'));

-- 4. updated_at triggers
CREATE TRIGGER trg_duty_locations_updated BEFORE UPDATE ON public.duty_locations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_duty_assignments_updated BEFORE UPDATE ON public.duty_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_duty_logs_updated BEFORE UPDATE ON public.duty_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Seed default locations
INSERT INTO public.duty_locations (name, order_index) VALUES
  ('หน้าประตูโรงเรียน', 1),
  ('โรงอาหาร', 2),
  ('อาคารเรียน', 3),
  ('สนามกีฬา', 4),
  ('ห้องน้ำนักเรียน', 5);
