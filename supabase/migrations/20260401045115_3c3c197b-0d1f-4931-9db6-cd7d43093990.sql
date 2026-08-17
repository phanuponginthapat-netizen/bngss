
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;

DROP POLICY IF EXISTS "Admin and Director can view all profiles" ON public.profiles;
CREATE POLICY "Admin and Director can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director')
);
