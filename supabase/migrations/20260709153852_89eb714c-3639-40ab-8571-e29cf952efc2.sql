-- 1) homework_submissions: block students from editing grading columns
DROP FUNCTION IF EXISTS public.prevent_student_grade_tamper_homework() CASCADE;
CREATE OR REPLACE FUNCTION public.prevent_student_grade_tamper_homework()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_staff boolean;
  is_student boolean;
BEGIN
  is_staff := public.has_role(auth.uid(), 'admin'::app_role)
           OR public.has_role(auth.uid(), 'director'::app_role)
           OR public.has_role(auth.uid(), 'teacher'::app_role);
  IF is_staff THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.auth_user_id = auth.uid() AND s.id = NEW.student_id
  ) INTO is_student;

  IF is_student THEN
    NEW.score       := OLD.score;
    NEW.final_score := OLD.final_score;
    NEW.auto_score  := OLD.auto_score;
    NEW.feedback    := OLD.feedback;
    NEW.graded_at   := OLD.graded_at;
    NEW.graded_by   := OLD.graded_by;
  END IF;

  RETURN NEW;
END;
$$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_prevent_student_grade_tamper_homework ON public.homework_submissions';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_prevent_student_grade_tamper_homework
BEFORE UPDATE ON public.homework_submissions
FOR EACH ROW
EXECUTE FUNCTION public.prevent_student_grade_tamper_homework()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- 2) task_assignments: block students from editing grade/feedback/etc.
DROP FUNCTION IF EXISTS public.prevent_student_grade_tamper_tasks() CASCADE;
CREATE OR REPLACE FUNCTION public.prevent_student_grade_tamper_tasks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_staff boolean;
  is_student boolean;
BEGIN
  is_staff := public.has_role(auth.uid(), 'admin'::app_role)
           OR public.has_role(auth.uid(), 'director'::app_role)
           OR public.has_role(auth.uid(), 'teacher'::app_role);
  IF is_staff THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.auth_user_id = auth.uid()
  ) INTO is_student;

  IF is_student THEN
    NEW.grade              := OLD.grade;
    NEW.feedback           := OLD.feedback;
    NEW.annotated_file_url := OLD.annotated_file_url;
    NEW.max_score          := OLD.max_score;
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status NOT IN ('submitted', 'in_progress')
    THEN
      NEW.status := OLD.status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_prevent_student_grade_tamper_tasks ON public.task_assignments';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_prevent_student_grade_tamper_tasks
BEFORE UPDATE ON public.task_assignments
FOR EACH ROW
EXECUTE FUNCTION public.prevent_student_grade_tamper_tasks()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- 3) social_posts: moderation flag + gate public reads to approved posts
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Public can read social posts" ON public.social_posts';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Public can read published social posts" ON public.social_posts';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Public can read published social posts" ON public.social_posts';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Public can read published social posts"
ON public.social_posts
FOR SELECT
TO anon, authenticated
USING (is_published = true)';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
