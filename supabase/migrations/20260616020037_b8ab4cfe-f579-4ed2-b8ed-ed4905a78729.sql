
-- Revert column-level restriction on personnel; rely on RLS for row scoping.
GRANT SELECT ON public.personnel TO authenticated;
