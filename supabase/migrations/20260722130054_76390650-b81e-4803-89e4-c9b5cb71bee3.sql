-- Recreate 9 policies without super_admin/school_admin
DROP POLICY IF EXISTS duty_assign_admin_write ON public.duty_assignments;
CREATE POLICY duty_assign_admin_write ON public.duty_assignments FOR ALL
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'director'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'director'::app_role));

DROP POLICY IF EXISTS duty_locations_admin_write ON public.duty_locations;
CREATE POLICY duty_locations_admin_write ON public.duty_locations FOR ALL
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'director'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'director'::app_role));

DROP POLICY IF EXISTS duty_logs_delete_admin ON public.duty_logs;
CREATE POLICY duty_logs_delete_admin ON public.duty_logs FOR DELETE
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'director'::app_role));

DROP POLICY IF EXISTS duty_logs_insert_self_or_admin ON public.duty_logs;
CREATE POLICY duty_logs_insert_self_or_admin ON public.duty_logs FOR INSERT
  WITH CHECK (reported_by = auth.uid() OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'director'::app_role));

DROP POLICY IF EXISTS duty_logs_update_owner_or_admin ON public.duty_logs;
CREATE POLICY duty_logs_update_owner_or_admin ON public.duty_logs FOR UPDATE
  USING (reported_by = auth.uid() OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'director'::app_role));

DROP POLICY IF EXISTS vault_groups_admin_all ON public.line_vault_groups;
CREATE POLICY vault_groups_admin_all ON public.line_vault_groups FOR ALL
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

DROP POLICY IF EXISTS vault_items_admin_all ON public.line_vault_items;
CREATE POLICY vault_items_admin_all ON public.line_vault_items FOR ALL
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

DROP POLICY IF EXISTS trash_admin_read ON public.line_vault_drive_trash;
CREATE POLICY trash_admin_read ON public.line_vault_drive_trash FOR SELECT
  USING (has_role(auth.uid(),'admin'::app_role));

DROP POLICY IF EXISTS scores_read_staff_same_school ON public.game_hub_scores;
CREATE POLICY scores_read_staff_same_school ON public.game_hub_scores FOR SELECT
  USING (
    (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'teacher'::app_role) OR has_role(auth.uid(),'director'::app_role))
    AND EXISTS (SELECT 1 FROM students s WHERE s.id = game_hub_scores.student_id
      AND s.school_id = (SELECT school_id FROM profiles WHERE id = auth.uid()))
  );

CREATE OR REPLACE FUNCTION public.is_admin_or_director(_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin'::app_role,'director'::app_role))
$$;

CREATE OR REPLACE FUNCTION public.prevent_personnel_self_escalation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() = NEW.user_id AND NOT public.has_role(auth.uid(),'admin') AND NOT public.has_role(auth.uid(),'director') THEN
    NEW.position       := OLD.position;
    NEW.position_level := OLD.position_level;
    NEW.department     := OLD.department;
    NEW.employee_code  := OLD.employee_code;
    NEW.status         := OLD.status;
  END IF;
  RETURN NEW;
END $$;

DROP POLICY IF EXISTS "Shared masters readable by shared roles" ON public.print_templates;

-- Recreate enum
ALTER TYPE public.app_role RENAME TO app_role_old;
CREATE TYPE public.app_role AS ENUM ('admin','teacher','student','director','alumni','parent','observer');
ALTER TABLE public.user_roles ALTER COLUMN role TYPE public.app_role USING role::text::public.app_role;

DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role_old) CASCADE;
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon, service_role;

DROP FUNCTION IF EXISTS public.get_user_role(uuid) CASCADE;
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated, service_role;

DROP TYPE public.app_role_old CASCADE;

CREATE POLICY "Shared masters readable by shared roles" ON public.print_templates FOR SELECT
  USING (
    is_system_master = true AND published_at IS NOT NULL
    AND EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid()
      AND (ur.role)::text = ANY (print_templates.shared_with_roles))
  );

CREATE INDEX IF NOT EXISTS idx_user_roles_user_role ON public.user_roles(user_id, role);