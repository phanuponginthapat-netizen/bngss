
-- ============ 1. TABLE POLICIES: add school scoping ============

-- assets
DROP POLICY IF EXISTS "Authenticated can view assets" ON public.assets;
CREATE POLICY "Authenticated can view assets in same school"
ON public.assets FOR SELECT TO authenticated
USING (
  school_id = public.get_user_school_id(auth.uid())
  OR public.is_staff_user(auth.uid())
);

-- schedules
DROP POLICY IF EXISTS "Auth users can view schedules" ON public.schedules;
CREATE POLICY "Auth users can view schedules in same school"
ON public.schedules FOR SELECT TO authenticated
USING (
  school_id = public.get_user_school_id(auth.uid())
  OR public.is_staff_user(auth.uid())
);

-- classrooms
DROP POLICY IF EXISTS "Auth users can view classrooms" ON public.classrooms;
CREATE POLICY "Auth users can view classrooms in same school"
ON public.classrooms FOR SELECT TO authenticated
USING (
  school_id = public.get_user_school_id(auth.uid())
  OR public.is_staff_user(auth.uid())
);

-- homework_assignments
DROP POLICY IF EXISTS "Auth users can view homework_assignments" ON public.homework_assignments;
CREATE POLICY "Auth users can view homework in same school"
ON public.homework_assignments FOR SELECT TO authenticated
USING (
  school_id = public.get_user_school_id(auth.uid())
  OR public.is_staff_user(auth.uid())
);

-- academic_events
DROP POLICY IF EXISTS "Auth users view academic events" ON public.academic_events;
CREATE POLICY "Auth users view academic events in same school"
ON public.academic_events FOR SELECT TO authenticated
USING (
  school_id = public.get_user_school_id(auth.uid())
  OR public.is_staff_user(auth.uid())
);

-- subjects
DROP POLICY IF EXISTS "Authenticated users can view subjects" ON public.subjects;
CREATE POLICY "Authenticated users can view subjects in same school"
ON public.subjects FOR SELECT TO authenticated
USING (
  school_id = public.get_user_school_id(auth.uid())
  OR public.is_staff_user(auth.uid())
);

-- school_test_scores
DROP POLICY IF EXISTS "Auth users view test scores" ON public.school_test_scores;
CREATE POLICY "Auth users view test scores in same school"
ON public.school_test_scores FOR SELECT TO authenticated
USING (
  school_id = public.get_user_school_id(auth.uid())
  OR public.is_staff_user(auth.uid())
);

-- ============ 2. STORAGE POLICIES: add ownership/school join ============

-- hub-projects: path = {project_id}/...
DROP POLICY IF EXISTS "hub-projects read auth" ON storage.objects;
CREATE POLICY "hub-projects read scoped"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'hub-projects'
  AND (
    public.is_staff_user(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.hub_projects hp
      WHERE hp.id::text = (storage.foldername(name))[1]
        AND (
          hp.school_id = public.get_user_school_id(auth.uid())
          OR hp.created_by = auth.uid()
        )
    )
  )
);

-- learning-content: path = {content_id}/...
DROP POLICY IF EXISTS "learn_storage_select_auth" ON storage.objects;
CREATE POLICY "learn_storage_select_scoped"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'learning-content'
  AND EXISTS (
    SELECT 1 FROM public.learning_contents lc
    WHERE lc.id::text = (storage.foldername(name))[1]
      AND (
        lc.owner_id = auth.uid()
        OR public.is_staff_user(auth.uid())
        OR lc.visibility = 'public'
        OR (
          lc.is_active
          AND lc.visibility IN ('school','public')
          AND lc.school_id = public.get_user_school_id(auth.uid())
        )
      )
  )
);

-- teaching-reflections: path = {teacher_id}/{reflection_id}/...
DROP POLICY IF EXISTS "tr_files_select" ON storage.objects;
CREATE POLICY "tr_files_select_scoped"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'teaching-reflections'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'director'::app_role)
  )
);

-- worksheet-files: path = {uploader_user_id}/...
DROP POLICY IF EXISTS "wsf_authenticated_read" ON storage.objects;
CREATE POLICY "wsf_read_scoped"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'worksheet-files'
  AND (
    owner = auth.uid()
    OR public.is_staff_user(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND p.school_id = public.get_user_school_id(auth.uid())
    )
  )
);
