
CREATE OR REPLACE FUNCTION public.rls_policy_audit()
RETURNS TABLE (
  table_name text,
  rls_enabled boolean,
  policy_count int,
  has_select boolean,
  has_insert boolean,
  has_update boolean,
  has_delete boolean,
  policies jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT
    c.relname::text AS table_name,
    c.relrowsecurity AS rls_enabled,
    COALESCE(p.cnt, 0)::int AS policy_count,
    COALESCE(p.has_select, false) AS has_select,
    COALESCE(p.has_insert, false) AS has_insert,
    COALESCE(p.has_update, false) AS has_update,
    COALESCE(p.has_delete, false) AS has_delete,
    COALESCE(p.policies, '[]'::jsonb) AS policies
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN (
    SELECT
      pol.schemaname,
      pol.tablename,
      COUNT(*) AS cnt,
      bool_or(pol.cmd IN ('SELECT','ALL')) AS has_select,
      bool_or(pol.cmd IN ('INSERT','ALL')) AS has_insert,
      bool_or(pol.cmd IN ('UPDATE','ALL')) AS has_update,
      bool_or(pol.cmd IN ('DELETE','ALL')) AS has_delete,
      jsonb_agg(jsonb_build_object(
        'name', pol.policyname,
        'cmd', pol.cmd,
        'roles', pol.roles,
        'permissive', pol.permissive
      ) ORDER BY pol.policyname) AS policies
    FROM pg_policies pol
    WHERE pol.schemaname = 'public'
    GROUP BY pol.schemaname, pol.tablename
  ) p ON p.schemaname = n.nspname AND p.tablename = c.relname
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND public.has_role(auth.uid(), 'admin'::app_role)
  ORDER BY c.relname;
$$;

REVOKE ALL ON FUNCTION public.rls_policy_audit() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rls_policy_audit() TO authenticated;
