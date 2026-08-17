
-- 1) cms_settings: remove blanket authenticated read; keep admin/director full, others use allowlist
DROP POLICY IF EXISTS "Auth view all cms settings" ON public.cms_settings;

DROP POLICY IF EXISTS "Admin/director view all cms settings" ON public.cms_settings;
CREATE POLICY "Admin/director view all cms settings"
ON public.cms_settings
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'director'::app_role));

-- 2) social_posts: revoke access to raw payload column from public roles
REVOKE SELECT (raw) ON public.social_posts FROM anon;
REVOKE SELECT (raw) ON public.social_posts FROM authenticated;
GRANT SELECT (raw) ON public.social_posts TO service_role;

-- 3) school scope restrictive policies for operational tables
DROP POLICY IF EXISTS "school_scope_restrictive" ON public.bus_routes;
CREATE POLICY "school_scope_restrictive"
ON public.bus_routes
AS RESTRICTIVE
FOR ALL
TO authenticated
USING ((school_id IS NULL) OR (school_id = public.get_user_school_id(auth.uid())));

DROP POLICY IF EXISTS "school_scope_restrictive" ON public.vehicle_bookings;
CREATE POLICY "school_scope_restrictive"
ON public.vehicle_bookings
AS RESTRICTIVE
FOR ALL
TO authenticated
USING ((school_id IS NULL) OR (school_id = public.get_user_school_id(auth.uid())));

DROP POLICY IF EXISTS "school_scope_restrictive" ON public.room_bookings;
CREATE POLICY "school_scope_restrictive"
ON public.room_bookings
AS RESTRICTIVE
FOR ALL
TO authenticated
USING ((school_id IS NULL) OR (school_id = public.get_user_school_id(auth.uid())));

DROP POLICY IF EXISTS "school_scope_restrictive" ON public.duty_assignments;
CREATE POLICY "school_scope_restrictive"
ON public.duty_assignments
AS RESTRICTIVE
FOR ALL
TO authenticated
USING ((school_id IS NULL) OR (school_id = public.get_user_school_id(auth.uid())));

DROP POLICY IF EXISTS "school_scope_restrictive" ON public.duty_logs;
CREATE POLICY "school_scope_restrictive"
ON public.duty_logs
AS RESTRICTIVE
FOR ALL
TO authenticated
USING ((school_id IS NULL) OR (school_id = public.get_user_school_id(auth.uid())));
