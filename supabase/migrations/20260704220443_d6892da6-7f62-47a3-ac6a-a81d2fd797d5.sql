-- Template master system: mark templates as system-wide masters, categorize, share with roles
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.print_templates
  ADD COLUMN IF NOT EXISTS is_system_master boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS is_default_for_category boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shared_with_roles text[] NOT NULL DEFAULT ARRAY[''admin'',''director'',''teacher'']::text[],
  ADD COLUMN IF NOT EXISTS published_at timestamptz';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $idxguard$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS print_templates_category_idx ON public.print_templates(category) WHERE is_system_master = true';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
-- Only one default per category
DO $idxguard$
BEGIN
  EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS print_templates_default_per_category_uidx
  ON public.print_templates(category) WHERE is_default_for_category = true';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
-- RLS: allow shared roles to read published master templates
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Shared masters readable by shared roles" ON public.print_templates';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Shared masters readable by shared roles" ON public.print_templates';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Shared masters readable by shared roles"
ON public.print_templates
FOR SELECT
TO authenticated
USING (
  is_system_master = true
  AND published_at IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role::text = ANY(shared_with_roles)
  )
)';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
