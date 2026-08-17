DROP FUNCTION IF EXISTS public._is_admin_or_director() CASCADE;
CREATE OR REPLACE FUNCTION public._is_admin_or_director()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT current_user = 'service_role'
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'director'::app_role);
$$;