-- Add second LINE ID column to students
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.students ADD COLUMN IF NOT EXISTS line_user_id_2 text';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- Create parent-student linking table
CREATE TABLE IF NOT EXISTS public.parent_student_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_user_id uuid NOT NULL,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  student_code text NOT NULL,
  relationship text NOT NULL DEFAULT 'ผู้ปกครอง',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
DO $idxguard$
BEGIN
  EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS idx_parent_student_unique ON public.parent_student_links(parent_user_id, student_id)';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.parent_student_links ENABLE ROW LEVEL SECURITY';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- Parents can view their own links
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Parents can view own links" ON public.parent_student_links';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Parents can view own links" ON public.parent_student_links';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Parents can view own links"
ON public.parent_student_links
FOR SELECT TO authenticated
USING (parent_user_id = auth.uid())';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- Parents can create links  
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Parents can create links" ON public.parent_student_links';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Parents can create links" ON public.parent_student_links';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Parents can create links"
ON public.parent_student_links
FOR INSERT TO authenticated
WITH CHECK (parent_user_id = auth.uid() AND has_role(auth.uid(), ''parent''::app_role))';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- Admin/Director manage all
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Admin can manage parent_student_links" ON public.parent_student_links';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Admin can manage parent_student_links" ON public.parent_student_links';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Admin can manage parent_student_links"
ON public.parent_student_links
FOR ALL TO authenticated
USING (has_role(auth.uid(), ''admin''::app_role) OR has_role(auth.uid(), ''director''::app_role))
WITH CHECK (has_role(auth.uid(), ''admin''::app_role) OR has_role(auth.uid(), ''director''::app_role))';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- Parents can view linked students
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Parents can view linked students" ON public.students';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Parents can view linked students" ON public.students';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Parents can view linked students"
ON public.students
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), ''parent''::app_role) 
  AND id IN (SELECT student_id FROM public.parent_student_links WHERE parent_user_id = auth.uid())
)';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- Parents can view linked student attendance
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Parents can view linked student attendance" ON public.attendance';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Parents can view linked student attendance" ON public.attendance';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Parents can view linked student attendance"
ON public.attendance
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), ''parent''::app_role)
  AND student_id IN (SELECT student_id FROM public.parent_student_links WHERE parent_user_id = auth.uid())
)';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- Parents can view linked student behavior
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Parents can view linked student behavior" ON public.behavior_records';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Parents can view linked student behavior" ON public.behavior_records';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Parents can view linked student behavior"
ON public.behavior_records
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), ''parent''::app_role)
  AND student_id IN (SELECT student_id FROM public.parent_student_links WHERE parent_user_id = auth.uid())
)';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- Parents can submit student leave
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Parents can create student leave" ON public.student_leaves';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Parents can create student leave" ON public.student_leaves';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Parents can create student leave"
ON public.student_leaves
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), ''parent''::app_role)
  AND student_id IN (SELECT student_id FROM public.parent_student_links WHERE parent_user_id = auth.uid())
)';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- Parents can view student leaves
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Parents can view linked student leaves" ON public.student_leaves';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Parents can view linked student leaves" ON public.student_leaves';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Parents can view linked student leaves"
ON public.student_leaves
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), ''parent''::app_role)
  AND student_id IN (SELECT student_id FROM public.parent_student_links WHERE parent_user_id = auth.uid())
)';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
