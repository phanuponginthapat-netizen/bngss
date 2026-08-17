-- ============ 1) Schema blueprint exporter ============
DROP FUNCTION IF EXISTS public.export_schema_sql() CASCADE;
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

  -- enums
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

  -- tables + columns
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

  -- primary / unique / check constraints
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

  -- foreign keys (after all tables exist)
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

  -- indexes (skip ones backing constraints)
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

  -- functions
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

  -- triggers
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

  -- grants
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

  -- function execute grants
  FOR r IN
    SELECT g.grantee, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM information_schema.role_routine_grants g
    JOIN pg_proc p ON p.oid = (g.specific_name::text)::regprocedure::oid
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE g.routine_schema = 'public' AND n.nspname = 'public'
      AND g.grantee IN ('anon','authenticated','service_role')
      AND g.privilege_type = 'EXECUTE'
  LOOP
    out_sql := out_sql || 'GRANT EXECUTE ON FUNCTION public.' || quote_ident(r.proname)
      || '(' || r.args || ') TO ' || quote_ident(r.grantee) || E';\n';
  END LOOP;

  -- RLS enable
  out_sql := out_sql || E'\n-- ===== ROW LEVEL SECURITY =====\n';
  FOR r IN
    SELECT c.relname AS tbl, c.relrowsecurity, c.relforcerowsecurity
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
    ORDER BY c.relname
  LOOP
    out_sql := out_sql || 'ALTER TABLE public.' || quote_ident(r.tbl) || E' ENABLE ROW LEVEL SECURITY;\n';
  END LOOP;

  -- policies
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
DO $guard$
BEGIN
  EXECUTE 'REVOKE ALL ON FUNCTION public.export_schema_sql() FROM PUBLIC, anon, authenticated';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.export_schema_sql() TO service_role';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- ============ 2) Auth users export / import (keep same passwords) ============
DROP FUNCTION IF EXISTS public.export_auth_users() CASCADE;
CREATE OR REPLACE FUNCTION public.export_auth_users()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $fn$
  SELECT jsonb_build_object(
    'users', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', u.id,
        'aud', u.aud,
        'role', u.role,
        'email', u.email,
        'phone', u.phone,
        'encrypted_password', u.encrypted_password,
        'email_confirmed_at', u.email_confirmed_at,
        'phone_confirmed_at', u.phone_confirmed_at,
        'raw_app_meta_data', u.raw_app_meta_data,
        'raw_user_meta_data', u.raw_user_meta_data,
        'is_super_admin', u.is_super_admin,
        'created_at', u.created_at,
        'updated_at', u.updated_at,
        'last_sign_in_at', u.last_sign_in_at,
        'banned_until', u.banned_until,
        'is_sso_user', u.is_sso_user
      )) FROM auth.users u
    ), '[]'::jsonb),
    'identities', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', i.id,
        'user_id', i.user_id,
        'provider', i.provider,
        'provider_id', i.provider_id,
        'identity_data', i.identity_data,
        'created_at', i.created_at,
        'updated_at', i.updated_at,
        'last_sign_in_at', i.last_sign_in_at
      )) FROM auth.identities i
    ), '[]'::jsonb)
  );
$fn$;
DO $guard$
BEGIN
  EXECUTE 'REVOKE ALL ON FUNCTION public.export_auth_users() FROM PUBLIC, anon, authenticated';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.export_auth_users() TO service_role';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DROP FUNCTION IF EXISTS public.import_auth_users(jsonb) CASCADE;
CREATE OR REPLACE FUNCTION public.import_auth_users(_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $fn$
DECLARE
  u jsonb;
  i jsonb;
  n_users int := 0;
  n_ident int := 0;
BEGIN
  FOR u IN SELECT * FROM jsonb_array_elements(COALESCE(_payload->'users', '[]'::jsonb))
  LOOP
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, phone, encrypted_password,
      email_confirmed_at, phone_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin,
      created_at, updated_at, last_sign_in_at, banned_until, is_sso_user
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      (u->>'id')::uuid,
      COALESCE(u->>'aud','authenticated'),
      COALESCE(u->>'role','authenticated'),
      NULLIF(u->>'email',''),
      NULLIF(u->>'phone',''),
      u->>'encrypted_password',
      (u->>'email_confirmed_at')::timestamptz,
      (u->>'phone_confirmed_at')::timestamptz,
      COALESCE(u->'raw_app_meta_data', '{}'::jsonb),
      COALESCE(u->'raw_user_meta_data', '{}'::jsonb),
      COALESCE((u->>'is_super_admin')::boolean, false),
      COALESCE((u->>'created_at')::timestamptz, now()),
      COALESCE((u->>'updated_at')::timestamptz, now()),
      (u->>'last_sign_in_at')::timestamptz,
      (u->>'banned_until')::timestamptz,
      COALESCE((u->>'is_sso_user')::boolean, false)
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      encrypted_password = EXCLUDED.encrypted_password,
      email_confirmed_at = EXCLUDED.email_confirmed_at,
      raw_app_meta_data = EXCLUDED.raw_app_meta_data,
      raw_user_meta_data = EXCLUDED.raw_user_meta_data,
      updated_at = now();
    n_users := n_users + 1;
  END LOOP;

  FOR i IN SELECT * FROM jsonb_array_elements(COALESCE(_payload->'identities', '[]'::jsonb))
  LOOP
    BEGIN
      INSERT INTO auth.identities (
        id, user_id, provider, provider_id, identity_data,
        created_at, updated_at, last_sign_in_at
      ) VALUES (
        COALESCE((i->>'id')::uuid, gen_random_uuid()),
        (i->>'user_id')::uuid,
        i->>'provider',
        COALESCE(i->>'provider_id', i->>'user_id'),
        COALESCE(i->'identity_data', '{}'::jsonb),
        COALESCE((i->>'created_at')::timestamptz, now()),
        COALESCE((i->>'updated_at')::timestamptz, now()),
        (i->>'last_sign_in_at')::timestamptz
      )
      ON CONFLICT DO NOTHING;
      n_ident := n_ident + 1;
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END LOOP;

  RETURN jsonb_build_object('users', n_users, 'identities', n_ident);
END;
$fn$;
DO $guard$
BEGIN
  EXECUTE 'REVOKE ALL ON FUNCTION public.import_auth_users(jsonb) FROM PUBLIC, anon, authenticated';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.import_auth_users(jsonb) TO service_role';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- ============ 3) Storage bucket config export ============
DROP FUNCTION IF EXISTS public.export_storage_buckets() CASCADE;
CREATE OR REPLACE FUNCTION public.export_storage_buckets()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, storage, pg_catalog
AS $fn$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', b.id,
    'name', b.name,
    'public', b.public,
    'file_size_limit', b.file_size_limit,
    'allowed_mime_types', b.allowed_mime_types
  )), '[]'::jsonb) FROM storage.buckets b;
$fn$;
DO $guard$
BEGIN
  EXECUTE 'REVOKE ALL ON FUNCTION public.export_storage_buckets() FROM PUBLIC, anon, authenticated';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.export_storage_buckets() TO service_role';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- ============ 4) Storage RLS policies export ============
DROP FUNCTION IF EXISTS public.export_storage_policies_sql() CASCADE;
CREATE OR REPLACE FUNCTION public.export_storage_policies_sql()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage, pg_catalog
AS $fn$
DECLARE
  out_sql text := E'-- storage.objects policies\n';
  r record;
BEGIN
  FOR r IN
    SELECT p.tablename, p.policyname, p.permissive, p.roles, p.cmd, p.qual, p.with_check
    FROM pg_policies p WHERE p.schemaname = 'storage'
    ORDER BY p.tablename, p.policyname
  LOOP
    out_sql := out_sql || 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname)
      || ' ON storage.' || quote_ident(r.tablename) || E';\n'
      || 'CREATE POLICY ' || quote_ident(r.policyname)
      || ' ON storage.' || quote_ident(r.tablename)
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
DO $guard$
BEGIN
  EXECUTE 'REVOKE ALL ON FUNCTION public.export_storage_policies_sql() FROM PUBLIC, anon, authenticated';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.export_storage_policies_sql() TO service_role';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- ============ 5) Restore-time SQL executor (service_role only) ============
DROP FUNCTION IF EXISTS public.exec_restore_sql(text) CASCADE;
CREATE OR REPLACE FUNCTION public.exec_restore_sql(_sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
BEGIN
  EXECUTE _sql;
END;
$fn$;
DO $guard$
BEGIN
  EXECUTE 'REVOKE ALL ON FUNCTION public.exec_restore_sql(text) FROM PUBLIC, anon, authenticated';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.exec_restore_sql(text) TO service_role';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
