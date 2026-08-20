-- 1) Function search_path
ALTER FUNCTION public.enforce_single_school() SET search_path = public;

-- 2) homework_assignments: remove staff bypass + add restrictive school scope
DROP POLICY IF EXISTS "Auth users can view homework in same school" ON public.homework_assignments;
DROP POLICY IF EXISTS "homework_assignments_school_scope_restrictive" ON public.homework_assignments;
CREATE POLICY "homework_assignments_school_scope_restrictive"
ON public.homework_assignments AS RESTRICTIVE FOR ALL TO authenticated
USING (school_id IS NULL OR school_id = public.get_user_school_id(auth.uid()))
WITH CHECK (school_id IS NULL OR school_id = public.get_user_school_id(auth.uid()));

-- 3) profiles: restrictive school scope (own profile always allowed)
DROP POLICY IF EXISTS "profiles_school_scope_restrictive" ON public.profiles;
CREATE POLICY "profiles_school_scope_restrictive"
ON public.profiles AS RESTRICTIVE FOR ALL TO authenticated
USING (id = auth.uid() OR school_id IS NULL OR school_id = public.get_user_school_id(auth.uid()))
WITH CHECK (id = auth.uid() OR school_id IS NULL OR school_id = public.get_user_school_id(auth.uid()));

-- 4) task_assignments: restrictive scope through classroom school
DROP POLICY IF EXISTS "task_assignments_school_scope_restrictive" ON public.task_assignments;
CREATE POLICY "task_assignments_school_scope_restrictive"
ON public.task_assignments AS RESTRICTIVE FOR ALL TO authenticated
USING (
  classroom_id IS NULL OR EXISTS (
    SELECT 1 FROM public.classrooms c
    WHERE c.id = task_assignments.classroom_id
      AND (c.school_id IS NULL OR c.school_id = public.get_user_school_id(auth.uid()))
  )
)
WITH CHECK (
  classroom_id IS NULL OR EXISTS (
    SELECT 1 FROM public.classrooms c
    WHERE c.id = task_assignments.classroom_id
      AND (c.school_id IS NULL OR c.school_id = public.get_user_school_id(auth.uid()))
  )
);

-- 5) school_settings: replace blanket authenticated read
DROP POLICY IF EXISTS "Authenticated read general settings" ON public.school_settings;
DROP POLICY IF EXISTS "Authenticated read allowed settings" ON public.school_settings;
CREATE POLICY "Authenticated read allowed settings"
ON public.school_settings FOR SELECT TO authenticated
USING (
  public.is_staff_user(auth.uid())
  OR setting_key = ('first_login_done_' || auth.uid()::text)
  OR setting_key = ANY (ARRAY[
    'social_media_links','disabled_modules','kiosk_idle_timeout_sec','kiosk_hello_ai_enabled',
    'kiosk_power_save','kiosk_wake_word_enabled','face_scan_threshold','face_scan_voice',
    'face_scan_cutoff_time','face_scan_mode_cutoff','face_scan_entry_window','face_scan_exit_window'
  ])
  OR setting_key LIKE 'cms\_%'
  OR setting_key LIKE 'school\_%'
  OR setting_key LIKE 'theme\_%'
  OR setting_key LIKE 'module\_%'
  OR setting_key LIKE 'feature\_%'
  OR setting_key LIKE 'academic\_%'
  OR setting_key LIKE 'app\_%'
);