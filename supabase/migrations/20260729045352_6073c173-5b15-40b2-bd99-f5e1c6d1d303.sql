CREATE OR REPLACE FUNCTION public.export_schema_sql()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
DECLARE
  out_sql text := '';
  r record;
BEGIN
  out_sql := out_sql || E'-- Smart School schema blueprint\n-- generated: ' || now()::text || E'\nSET statement_timeout = 0;\nSET client_min_messages = warning;\nCREATE EXTENSION IF NOT EXISTS pgcrypto;\nCREATE EXTENSION IF NOT EXISTS "uuid-ossp";\n\n';

  out_sql := out_sql || E'-- ===== ENUM TYPES =====\n';
  FOR r IN
    SELECT t.typname,
           string_agg(quote_literal(e.enumlabel), ', ' ORDER BY e.enumsortorder) AS labels
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
    GROUP BY t.typname
  LOOP
    out_sql := out_sql || 'DO $$ BEGIN CREATE TYPE public.' || quote_ident(r.typname)
      || ' AS ENUM (' || r.labels || '); EXCEPTION WHEN duplicate_object THEN NULL; END $$;' || E'\n';
  END LOOP;

  out_sql := out_sql || E'\n-- ===== TABLES =====\n';
  FOR r IN
    SELECT c.relname AS tbl,
           string_agg(
             '  ' || quote_ident(a.attname) || ' ' || format_type(a.atttypid, a.atttypmod)
             || CASE WHEN ad.adbin IS NOT NULL THEN ' DEFAULT ' || pg_get_expr(ad.adbin, ad.adrelid) ELSE '' END
             || CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END,
             E',\n' ORDER BY a.attnum) AS cols
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
    LEFT JOIN pg_attrdef ad ON ad.adrelid = c.oid AND ad.adnum = a.attnum
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    GROUP BY c.relname
    ORDER BY c.relname
  LOOP
    out_sql := out_sql || 'CREATE TABLE IF NOT EXISTS public.' || quote_ident(r.tbl)
      || E' (\n' || r.cols || E'\n);\n';
  END LOOP;

  out_sql := out_sql || E'\n-- ===== CONSTRAINTS (PK/UNIQUE/CHECK) =====\n';
  FOR r IN
    SELECT cl.relname AS tbl, con.conname, pg_get_constraintdef(con.oid) AS def
    FROM pg_constraint con
    JOIN pg_class cl ON cl.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace
    WHERE n.nspname = 'public' AND con.contype IN ('p','u','c')
    ORDER BY cl.relname, con.conname
  LOOP
    out_sql := out_sql || 'DO $$ BEGIN ALTER TABLE public.' || quote_ident(r.tbl)
      || ' ADD CONSTRAINT ' || quote_ident(r.conname) || ' ' || r.def
      || '; EXCEPTION WHEN duplicate_table OR duplicate_object OR invalid_table_definition THEN NULL; END $$;' || E'\n';
  END LOOP;

  out_sql := out_sql || E'\n-- ===== FOREIGN KEYS =====\n';
  FOR r IN
    SELECT cl.relname AS tbl, con.conname, pg_get_constraintdef(con.oid) AS def
    FROM pg_constraint con
    JOIN pg_class cl ON cl.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace
    WHERE n.nspname = 'public' AND con.contype = 'f'
    ORDER BY cl.relname, con.conname
  LOOP
    out_sql := out_sql || 'DO $$ BEGIN ALTER TABLE public.' || quote_ident(r.tbl)
      || ' ADD CONSTRAINT ' || quote_ident(r.conname) || ' ' || r.def
      || '; EXCEPTION WHEN duplicate_object THEN NULL; END $$;' || E'\n';
  END LOOP;

  out_sql := out_sql || E'\n-- ===== INDEXES =====\n';
  FOR r IN
    SELECT indexdef
    FROM pg_indexes i
    WHERE i.schemaname = 'public'
      AND NOT EXISTS (
        SELECT 1 FROM pg_constraint con
        JOIN pg_class ic ON ic.oid = con.conindid
        WHERE ic.relname = i.indexname
      )
    ORDER BY i.tablename, i.indexname
  LOOP
    out_sql := out_sql || replace(r.indexdef, 'CREATE INDEX', 'CREATE INDEX IF NOT EXISTS') || E';\n';
  END LOOP;

  out_sql := out_sql || E'\n-- ===== FUNCTIONS =====\n';
  FOR r IN
    SELECT pg_get_functiondef(p.oid) AS def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind IN ('f','p')
    ORDER BY p.proname
  LOOP
    out_sql := out_sql || r.def || E';\n';
  END LOOP;

  out_sql := out_sql || E'\n-- ===== TRIGGERS =====\n';
  FOR r IN
    SELECT tg.tgname, cl.relname AS tbl, pg_get_triggerdef(tg.oid) AS def
    FROM pg_trigger tg
    JOIN pg_class cl ON cl.oid = tg.tgrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace
    WHERE n.nspname = 'public' AND NOT tg.tgisinternal
    ORDER BY cl.relname, tg.tgname
  LOOP
    out_sql := out_sql || 'DROP TRIGGER IF EXISTS ' || quote_ident(r.tgname)
      || ' ON public.' || quote_ident(r.tbl) || E';\n' || r.def || E';\n';
  END LOOP;

  out_sql := out_sql || E'\n-- ===== GRANTS =====\n';
  FOR r IN
    SELECT grantee, table_name, string_agg(DISTINCT privilege_type, ', ') AS privs
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND grantee IN ('anon','authenticated','service_role')
    GROUP BY grantee, table_name
    ORDER BY table_name, grantee
  LOOP
    out_sql := out_sql || 'GRANT ' || r.privs || ' ON public.' || quote_ident(r.table_name)
      || ' TO ' || quote_ident(r.grantee) || E';\n';
  END LOOP;

  -- function EXECUTE grants (via ACL, avoids regprocedure parsing issues)
  FOR r IN
    SELECT DISTINCT
           p.proname,
           pg_get_function_identity_arguments(p.oid) AS args,
           pg_get_userbyid(acl.grantee) AS grantee_name
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) AS acl
    WHERE n.nspname = 'public'
      AND acl.privilege_type = 'EXECUTE'
      AND acl.grantee <> 0
      AND pg_get_userbyid(acl.grantee) IN ('anon','authenticated','service_role')
    ORDER BY p.proname
  LOOP
    out_sql := out_sql || 'GRANT EXECUTE ON FUNCTION public.' || quote_ident(r.proname)
      || '(' || r.args || ') TO ' || quote_ident(r.grantee_name) || E';\n';
  END LOOP;

  out_sql := out_sql || E'\n-- ===== ROW LEVEL SECURITY =====\n';
  FOR r IN
    SELECT c.relname AS tbl
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
    ORDER BY c.relname
  LOOP
    out_sql := out_sql || 'ALTER TABLE public.' || quote_ident(r.tbl) || E' ENABLE ROW LEVEL SECURITY;\n';
  END LOOP;

  out_sql := out_sql || E'\n-- ===== POLICIES =====\n';
  FOR r IN
    SELECT p.tablename, p.policyname, p.permissive, p.roles, p.cmd, p.qual, p.with_check
    FROM pg_policies p
    WHERE p.schemaname = 'public'
    ORDER BY p.tablename, p.policyname
  LOOP
    out_sql := out_sql || 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname)
      || ' ON public.' || quote_ident(r.tablename) || E';\n';
    out_sql := out_sql || 'CREATE POLICY ' || quote_ident(r.policyname)
      || ' ON public.' || quote_ident(r.tablename)
      || ' AS ' || CASE WHEN r.permissive = 'PERMISSIVE' THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END
      || ' FOR ' || r.cmd
      || ' TO ' || array_to_string(r.roles, ', ')
      || CASE WHEN r.qual IS NOT NULL THEN ' USING (' || r.qual || ')' ELSE '' END
      || CASE WHEN r.with_check IS NOT NULL THEN ' WITH CHECK (' || r.with_check || ')' ELSE '' END
      || E';\n';
  END LOOP;

  RETURN out_sql;
END;
$fn$;

REVOKE ALL ON FUNCTION public.export_schema_sql() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.export_schema_sql() TO service_role;