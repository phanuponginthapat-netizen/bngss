
-- Tighten permissive SELECT policies to include school scoping / role checks

-- learning_center_bookings: restrict SELECT to same-school + authenticated
DROP POLICY IF EXISTS "LCB viewable by authenticated" ON public.learning_center_bookings;
CREATE POLICY "LCB viewable by same school"
ON public.learning_center_bookings
FOR SELECT
TO authenticated
USING (school_id IS NULL OR school_id = public.get_user_school_id(auth.uid()));

-- schedules: tighten permissive SELECT
DROP POLICY IF EXISTS "Auth users can view schedules" ON public.schedules;
CREATE POLICY "Auth users can view schedules in own school"
ON public.schedules
FOR SELECT
TO authenticated
USING (school_id IS NULL OR school_id = public.get_user_school_id(auth.uid()));

-- subjects: tighten permissive SELECT
DROP POLICY IF EXISTS "Authenticated users can view subjects" ON public.subjects;
CREATE POLICY "Users can view subjects in own school"
ON public.subjects
FOR SELECT
TO authenticated
USING (school_id IS NULL OR school_id = public.get_user_school_id(auth.uid()));

-- Storage: game-covers -- restrict direct SELECT to owner or staff (signed URLs still work)
DROP POLICY IF EXISTS "game_covers_auth_read" ON storage.objects;
CREATE POLICY "game_covers_owner_or_staff_read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'game-covers'
  AND (
    owner = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'director'::app_role)
    OR public.has_role(auth.uid(), 'teacher'::app_role)
  )
);

-- Storage: hub-projects -- restrict SELECT to same-school members of project
DROP POLICY IF EXISTS "hub-projects read auth" ON storage.objects;
CREATE POLICY "hub_projects_read_same_school"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'hub-projects'
  AND EXISTS (
    SELECT 1 FROM public.hub_projects hp
    WHERE hp.id::text = split_part(storage.objects.name, '/', 1)
      AND (hp.school_id IS NULL OR hp.school_id = public.get_user_school_id(auth.uid()))
  )
);

-- Storage: padlet -- scope reads/uploads to board viewers (path = {board_id}/{user_id}/file)
DROP POLICY IF EXISTS "padlet read authenticated" ON storage.objects;
CREATE POLICY "padlet_read_board_viewers"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'padlet'
  AND public.padlet_can_view_board((split_part(storage.objects.name, '/', 1))::uuid)
);

DROP POLICY IF EXISTS "padlet upload authenticated" ON storage.objects;
CREATE POLICY "padlet_upload_own_folder_board_viewers"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'padlet'
  AND split_part(storage.objects.name, '/', 2) = auth.uid()::text
  AND public.padlet_can_view_board((split_part(storage.objects.name, '/', 1))::uuid)
);
