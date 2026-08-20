-- 1) eforms recipient policy scoped to authenticated
DROP POLICY IF EXISTS "Recipients can view eforms sent to them" ON public.eforms;
CREATE POLICY "Recipients can view eforms sent to them"
ON public.eforms FOR SELECT TO authenticated
USING (public.is_eform_recipient(id, auth.uid()));

-- 2) user_departments / user_subject_groups: staff-only broad read
DROP POLICY IF EXISTS "Authenticated can view all department memberships" ON public.user_departments;
DROP POLICY IF EXISTS "Staff can view all department memberships" ON public.user_departments;
CREATE POLICY "Staff can view all department memberships"
ON public.user_departments FOR SELECT TO authenticated
USING (public.is_staff_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can view all subject group memberships" ON public.user_subject_groups;
DROP POLICY IF EXISTS "Staff can view all subject group memberships" ON public.user_subject_groups;
CREATE POLICY "Staff can view all subject group memberships"
ON public.user_subject_groups FOR SELECT TO authenticated
USING (public.is_staff_user(auth.uid()));

DROP POLICY IF EXISTS "Users can view own subject groups" ON public.user_subject_groups;
CREATE POLICY "Users can view own subject groups"
ON public.user_subject_groups FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- 3) remove secret tables from realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.app_secrets;
ALTER PUBLICATION supabase_realtime DROP TABLE public.ai_provider_keys;

-- 4) profile-images objects: signed-URL reads only
DROP POLICY IF EXISTS "profile-images authenticated read" ON storage.objects;
DROP POLICY IF EXISTS "profile-images signed read" ON storage.objects;
CREATE POLICY "profile-images signed read"
ON storage.objects FOR SELECT TO authenticated, anon
USING (bucket_id = 'profile-images');