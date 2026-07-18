-- Allow directors to view all user roles (needed for P-OBEC personnel page)
CREATE POLICY "Director can view all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'director'::app_role));