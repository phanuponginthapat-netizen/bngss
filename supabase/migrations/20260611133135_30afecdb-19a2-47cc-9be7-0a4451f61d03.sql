-- Rewrite to use proper UUID relationships
DROP FUNCTION IF EXISTS public.is_homeroom_teacher_of_student(uuid, uuid) CASCADE;
CREATE OR REPLACE FUNCTION public.is_homeroom_teacher_of_student(_user_id uuid, _student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.students s
    JOIN public.classrooms c ON c.id = s.classroom_id
    JOIN public.personnel p
      ON (p.id = c.homeroom_teacher_id OR p.id = c.homeroom_teacher_2_id)
    WHERE s.id = _student_id
      AND p.user_id = _user_id
  );
$$;
DO $guard$
BEGIN
  EXECUTE 'REVOKE EXECUTE ON FUNCTION public.is_homeroom_teacher_of_student(uuid, uuid) FROM PUBLIC, anon';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.is_homeroom_teacher_of_student(uuid, uuid) TO authenticated, service_role';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- List of classroom IDs the user is homeroom teacher of (main or assistant)
DROP FUNCTION IF EXISTS public.homeroom_classroom_ids_of(uuid) CASCADE;
CREATE OR REPLACE FUNCTION public.homeroom_classroom_ids_of(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id
  FROM public.classrooms c
  JOIN public.personnel p
    ON (p.id = c.homeroom_teacher_id OR p.id = c.homeroom_teacher_2_id)
  WHERE p.user_id = _user_id;
$$;
DO $guard$
BEGIN
  EXECUTE 'REVOKE EXECUTE ON FUNCTION public.homeroom_classroom_ids_of(uuid) FROM PUBLIC, anon';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.homeroom_classroom_ids_of(uuid) TO authenticated, service_role';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- Indexes to keep RLS lookups fast
DO $idxguard$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_personnel_user_id ON public.personnel(user_id)';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
DO $idxguard$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_classrooms_homeroom_teacher_id ON public.classrooms(homeroom_teacher_id)';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
DO $idxguard$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_classrooms_homeroom_teacher_2_id ON public.classrooms(homeroom_teacher_2_id)';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
DO $idxguard$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_students_classroom_id ON public.students(classroom_id)';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
