CREATE OR REPLACE FUNCTION public.export_extras_sql()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  out_sql text;
  r record;
BEGIN
  out_sql := public.export_extras_sql_base();

  -- realtime publication + replica identity
  out_sql := out_sql || E'\n-- realtime\n';
  out_sql := out_sql || E'DO $rt$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname=''supabase_realtime'') THEN CREATE PUBLICATION supabase_realtime; END IF; END $rt$;\n';

  FOR r IN
    SELECT c.relname, c.relreplident
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relreplident = 'f'
    ORDER BY c.relname
  LOOP
    out_sql := out_sql || 'ALTER TABLE public.' || quote_ident(r.relname) || E' REPLICA IDENTITY FULL;\n';
  END LOOP;

  FOR r IN
    SELECT tablename FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
    ORDER BY tablename
  LOOP
    out_sql := out_sql || 'DO $rt$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname=''supabase_realtime'' AND schemaname=''public'' AND tablename='
      || quote_literal(r.tablename) || ') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.'
      || quote_ident(r.tablename) || E'; END IF; END $rt$;\n';
  END LOOP;

  RETURN out_sql;
END;
$fn$;