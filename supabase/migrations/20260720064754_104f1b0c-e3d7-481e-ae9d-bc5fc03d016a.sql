
-- Allow teachers/directors to self-manage their own department & subject-group memberships
DROP POLICY IF EXISTS "Users manage own departments" ON public.user_departments;
DROP POLICY IF EXISTS "Users manage own departments" ON public.user_departments;
CREATE POLICY "Users manage own departments"
ON public.user_departments
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users manage own subject groups" ON public.user_subject_groups;
DROP POLICY IF EXISTS "Users manage own subject groups" ON public.user_subject_groups;
CREATE POLICY "Users manage own subject groups"
ON public.user_subject_groups
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Allow anyone authenticated to see who is in which department/group (for org chart & mentions)
DROP POLICY IF EXISTS "Authenticated can view all department memberships" ON public.user_departments;
DROP POLICY IF EXISTS "Authenticated can view all department memberships" ON public.user_departments;
CREATE POLICY "Authenticated can view all department memberships"
ON public.user_departments
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated can view all subject group memberships" ON public.user_subject_groups;
DROP POLICY IF EXISTS "Authenticated can view all subject group memberships" ON public.user_subject_groups;
CREATE POLICY "Authenticated can view all subject group memberships"
ON public.user_subject_groups
FOR SELECT
TO authenticated
USING (true);
