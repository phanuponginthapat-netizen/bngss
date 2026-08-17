DROP FUNCTION IF EXISTS public.get_db_schema() CASCADE;
CREATE OR REPLACE FUNCTION public.get_db_schema()
RETURNS TABLE(table_name text, columns jsonb, col_count int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.table_name::text,
    jsonb_agg(jsonb_build_object(
      'name', c.column_name,
      'type', c.data_type,
      'nullable', c.is_nullable,
      'default', c.column_default
    ) ORDER BY c.ordinal_position) AS columns,
    count(*)::int AS col_count
  FROM information_schema.columns c
  JOIN information_schema.tables t
    ON t.table_schema = c.table_schema AND t.table_name = c.table_name
  WHERE c.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'director'::app_role)
    )
  GROUP BY c.table_name
  ORDER BY c.table_name;
$$;
DO $guard$
BEGIN
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_db_schema() TO authenticated';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
