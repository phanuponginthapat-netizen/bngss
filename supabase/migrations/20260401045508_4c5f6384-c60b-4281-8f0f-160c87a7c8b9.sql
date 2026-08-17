-- Allow directors to view all user roles (needed for P-OBEC personnel page)
DROP POLICY IF EXISTS "Director can view all roles" ON public.user_roles;
CREATE POLICY "Director can view all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'director'::app_role));