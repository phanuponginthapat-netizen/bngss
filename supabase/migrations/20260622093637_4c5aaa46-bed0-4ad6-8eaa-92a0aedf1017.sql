DROP POLICY IF EXISTS "Auth users can view homework_assignments" ON public.homework_assignments;
CREATE POLICY "Auth users can view homework_assignments in their school"
ON public.homework_assignments FOR SELECT TO authenticated
USING (school_id IS NULL OR school_id = public.get_user_school_id(auth.uid()));