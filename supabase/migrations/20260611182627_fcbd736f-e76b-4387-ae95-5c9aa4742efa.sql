CREATE TABLE IF NOT EXISTS public.mascot_advice_cache (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  context_snapshot jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  next_refresh_at timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);
DO $guard$
BEGIN
  EXECUTE 'GRANT SELECT ON public.mascot_advice_cache TO authenticated';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'GRANT ALL ON public.mascot_advice_cache TO service_role';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.mascot_advice_cache ENABLE ROW LEVEL SECURITY';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users read own mascot cache" ON public.mascot_advice_cache';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users read own mascot cache" ON public.mascot_advice_cache';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Users read own mascot cache"
  ON public.mascot_advice_cache
  FOR SELECT TO authenticated
  USING (user_id = auth.uid())';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $idxguard$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_mascot_cache_refresh ON public.mascot_advice_cache (next_refresh_at)';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
