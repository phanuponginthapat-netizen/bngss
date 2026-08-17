DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "users can upsert own device row" ON public.kiosk_devices';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "users can update own device row" ON public.kiosk_devices';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "staff or owner can insert device row" ON public.kiosk_devices';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "staff or owner can insert device row" ON public.kiosk_devices';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "staff or owner can insert device row"
ON public.kiosk_devices
FOR INSERT
TO authenticated
WITH CHECK (
  (user_id = auth.uid())
  OR (
    user_id IS NULL AND (
      public.has_role(auth.uid(), ''admin''::app_role)
      OR public.has_role(auth.uid(), ''director''::app_role)
      OR public.has_role(auth.uid(), ''teacher''::app_role)
    )
  )
)';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "staff or owner can update device row" ON public.kiosk_devices';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "staff or owner can update device row" ON public.kiosk_devices';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "staff or owner can update device row"
ON public.kiosk_devices
FOR UPDATE
TO authenticated
USING (
  (user_id = auth.uid())
  OR public.has_role(auth.uid(), ''admin''::app_role)
  OR public.has_role(auth.uid(), ''director''::app_role)
  OR (
    user_id IS NULL AND public.has_role(auth.uid(), ''teacher''::app_role)
  )
)
WITH CHECK (
  (user_id = auth.uid())
  OR public.has_role(auth.uid(), ''admin''::app_role)
  OR public.has_role(auth.uid(), ''director''::app_role)
  OR (
    user_id IS NULL AND public.has_role(auth.uid(), ''teacher''::app_role)
  )
)';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
