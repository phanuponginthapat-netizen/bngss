-- PDPA Consent tracking table
CREATE TABLE IF NOT EXISTS public.pdpa_consents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  consent_version TEXT NOT NULL DEFAULT '1.0',
  accepted BOOLEAN NOT NULL DEFAULT true,
  accepted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
DO $idxguard$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_pdpa_consents_user ON public.pdpa_consents(user_id, accepted_at DESC)';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.pdpa_consents ENABLE ROW LEVEL SECURITY';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- Users can view their own consents
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users can view own pdpa consents" ON public.pdpa_consents';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users can view own pdpa consents" ON public.pdpa_consents';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Users can view own pdpa consents"
ON public.pdpa_consents FOR SELECT
TO authenticated
USING (auth.uid() = user_id)';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- Users can insert their own consents
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users can insert own pdpa consents" ON public.pdpa_consents';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users can insert own pdpa consents" ON public.pdpa_consents';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Users can insert own pdpa consents"
ON public.pdpa_consents FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id)';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- Admins/Directors can view all consents (audit)
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Admins can view all pdpa consents" ON public.pdpa_consents';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Admins can view all pdpa consents" ON public.pdpa_consents';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Admins can view all pdpa consents"
ON public.pdpa_consents FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), ''admin'') OR public.has_role(auth.uid(), ''director''))';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- Add must_change_password flag to profiles for forced password reset by admin
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pdpa_accepted_at TIMESTAMP WITH TIME ZONE';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pdpa_version TEXT';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
