CREATE TABLE IF NOT EXISTS public.health_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  measured_at date NOT NULL DEFAULT CURRENT_DATE,
  weight_kg numeric(5,2),
  height_cm numeric(5,2),
  bmi numeric(5,2) GENERATED ALWAYS AS (
    CASE WHEN height_cm IS NOT NULL AND height_cm > 0 AND weight_kg IS NOT NULL
      THEN ROUND((weight_kg / ((height_cm/100.0) * (height_cm/100.0)))::numeric, 2)
      ELSE NULL END
  ) STORED,
  notes text,
  recorded_by uuid,
  school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
DO $guard$
BEGIN
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_measurements TO authenticated';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'GRANT ALL ON public.health_measurements TO service_role';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.health_measurements ENABLE ROW LEVEL SECURITY';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Staff manage health_measurements" ON public.health_measurements';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Staff manage health_measurements" ON public.health_measurements';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Staff manage health_measurements" ON public.health_measurements
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),''admin'') OR public.has_role(auth.uid(),''director'') OR public.has_role(auth.uid(),''teacher''))
  WITH CHECK (public.has_role(auth.uid(),''admin'') OR public.has_role(auth.uid(),''director'') OR public.has_role(auth.uid(),''teacher''))';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Students view own measurements" ON public.health_measurements';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Students view own measurements" ON public.health_measurements';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Students view own measurements" ON public.health_measurements
  FOR SELECT TO authenticated
  USING (student_id IN (SELECT id FROM public.students WHERE auth_user_id = auth.uid()))';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $idxguard$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_health_measurements_student ON public.health_measurements(student_id, measured_at DESC)';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_health_measurements_updated_at ON public.health_measurements';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_health_measurements_updated_at
  BEFORE UPDATE ON public.health_measurements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $$

BEGIN

  IF NOT EXISTS (

    SELECT 1 FROM pg_publication_tables

    WHERE pubname = 'supabase_realtime'

      AND schemaname = 'public'

      AND tablename = 'health_measurements'

  ) THEN

    ALTER PUBLICATION supabase_realtime ADD TABLE public.health_measurements;

  END IF;

END $$;
