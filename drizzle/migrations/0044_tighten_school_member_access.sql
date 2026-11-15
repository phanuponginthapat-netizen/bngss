CREATE OR REPLACE FUNCTION public.is_school_member(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _uid IS NOT NULL AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid)
$$;
REVOKE ALL ON FUNCTION public.is_school_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_school_member(uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_staff_avatar_folder(_folder text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.personnel WHERE user_id::text = _folder)
$$;
GRANT EXECUTE ON FUNCTION public.is_staff_avatar_folder(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_public_ar_object(_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(_name,'') <> '' AND (
    EXISTS (SELECT 1 FROM public.ar_experiences e WHERE e.is_public AND (e.media_url LIKE '%' || _name OR e.poster_url LIKE '%' || _name OR e.marker_image_url LIKE '%' || _name))
    OR EXISTS (SELECT 1 FROM public.ar_projects p WHERE p.is_public AND (p.cover_url LIKE '%' || _name OR p.targets_url LIKE '%' || _name)))
$$;
GRANT EXECUTE ON FUNCTION public.is_public_ar_object(text) TO anon, authenticated, service_role;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('food_catalog','auth read food catalog'),('exercise_catalog','auth read exercise catalog'),
    ('scholarships','scholarships_read_all'),('tutoring_sessions','tutoring_read_all'),
    ('fitness_achievements','anyone view achievements'),('learning_center_bookings','LCB viewable by authenticated'),
    ('garbage_items','garbage_items_select'),('subject_indicators','Authenticated view subject_indicators'),
    ('padlet_notes','notes viewable by authenticated'),('garbage_badges','All auth view badges'),
    ('bus_stops','bus_stops_read_all'),('action_plans','Auth users can view action_plans'),
    ('observation_rubrics','recovery_rubrics_read'),('teacher_assignments','Authenticated view teacher_assignments'),
    ('garbage_user_badges','Auth view earned badges'),('print_template_versions','Auth read versions'),
    ('emergency_broadcasts','Auth users can view emergency_broadcasts'),
    ('teaching_reflection_signature_settings','sig_settings_read_all_auth'),
    ('sports_day_bonus_points','sdbp_read_all'),('activities','activities_read_authenticated'),
    ('bus_routes','bus_routes_read_all'),('activity_matches','am_read_authenticated'),
    ('sports_day_house_members','sdhm_read_all'),('subject_group_heads','Anyone authenticated can view subject group heads'),
    ('activity_posts','apost_read_authenticated'),('duty_assignments','duty_assign_select_auth'),
    ('duty_locations','duty_locations_select_auth'),('subject_score_columns','Anyone authenticated can view subject_score_columns'),
    ('garbage_rewards','garbage_rewards_select'),('form_templates','Authenticated can view form templates'),
    ('subject_grading_config','Authenticated read grading config'),('club_advisors','adv_select'),
    ('fitness_rewards','fitness_rewards read auth'),('print_templates','Anyone authenticated can read active templates'),
    ('padlet_boards','boards viewable by authenticated'),('data_retention_policies','retention_read_auth'),
    ('club_works','works_select')
  ) AS t(tbl, pol)
  LOOP
    EXECUTE format('ALTER POLICY %I ON public.%I USING (public.is_school_member(auth.uid()))', r.pol, r.tbl);
  END LOOP;
END $$;

ALTER POLICY "offsite_photos_staff_read" ON storage.objects USING (bucket_id = 'offsite-photos' AND (public.is_staff_any(auth.uid()) OR owner_id = (auth.uid())::text));
ALTER POLICY "asset-photos auth read" ON storage.objects USING (bucket_id = 'asset-photos' AND (public.is_staff_any(auth.uid()) OR owner_id = (auth.uid())::text));
ALTER POLICY "padlet_read_auth" ON storage.objects USING (bucket_id = 'padlet' AND (public.is_school_member(auth.uid()) OR owner_id = (auth.uid())::text));
ALTER POLICY "profile-images signed read" ON storage.objects USING (bucket_id = 'profile-images' AND (
  (storage.foldername(name))[1] = (auth.uid())::text OR owner_id = (auth.uid())::text
  OR public.is_school_member(auth.uid())
  OR public.is_staff_avatar_folder((storage.foldername(name))[1])));
ALTER POLICY "app_downloads_read_all" ON storage.objects USING (bucket_id = 'app-downloads' AND (
  public.is_school_member(auth.uid())
  OR name ~ '^[A-Za-z0-9._-]+\.(apk|zip|exe|ipa|json)$'));
ALTER POLICY "ar media public read" ON storage.objects USING (bucket_id = 'ar-media' AND (
  public.is_school_member(auth.uid()) OR owner_id = (auth.uid())::text
  OR public.is_public_ar_object(name)));
ALTER POLICY "line-vault authenticated read via row" ON storage.objects USING (bucket_id = 'line-vault' AND public.is_staff_any(auth.uid()) AND EXISTS (SELECT 1 FROM public.line_vault_items i WHERE i.storage_path = objects.name));
ALTER POLICY "attendance-photos auth upload" ON storage.objects WITH CHECK (bucket_id = 'attendance-photos' AND owner_id = (auth.uid())::text AND public.is_school_member(auth.uid()));
ALTER POLICY "padlet-media auth write" ON storage.objects WITH CHECK (bucket_id = 'padlet-media' AND owner_id = (auth.uid())::text AND public.is_school_member(auth.uid()));
ALTER POLICY "line-vault auth upload" ON storage.objects WITH CHECK (bucket_id = 'line-vault' AND owner_id = (auth.uid())::text AND public.is_staff_any(auth.uid()));

REVOKE ALL ON FUNCTION public.get_app_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_app_secret(text) TO service_role;

REVOKE ALL ON FUNCTION public.fitness_points_balance(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fitness_points_balance(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.fitness_check_achievements(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fitness_check_achievements(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.get_chat_user_profiles(_ids uuid[])
RETURNS TABLE(id uuid, first_name text, last_name text, nickname text, avatar_url text, student_code text, employee_code text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.first_name, p.last_name, p.nickname, p.avatar_url, p.student_code, p.employee_code
  FROM public.profiles p
  WHERE p.id = ANY(_ids)
    AND auth.uid() IS NOT NULL
    AND (p.id = auth.uid()
      OR public.is_staff_any(auth.uid())
      OR EXISTS (SELECT 1 FROM public.chat_participants a JOIN public.chat_participants b ON b.conversation_id = a.conversation_id
                 WHERE a.user_id = auth.uid() AND b.user_id = p.id));
$$;
REVOKE ALL ON FUNCTION public.get_chat_user_profiles(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_chat_user_profiles(uuid[]) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_classroom_subject_teachers(_classroom_id uuid)
RETURNS TABLE(personnel_id uuid, prefix text, first_name text, last_name text, position_name text, department text, email text, phone text, subject_id uuid, subject_name_th text, subject_code text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.prefix, p.first_name, p.last_name, p."position", p.department, p.email, p.phone, s.id, s.name_th, s.code
  FROM public.teacher_assignments ta
  JOIN public.personnel p ON p.id = ta.personnel_id
  LEFT JOIN public.subjects s ON s.id = ta.subject_id
  WHERE ta.classroom_id = _classroom_id
    AND auth.uid() IS NOT NULL
    AND (public.is_staff_any(auth.uid())
      OR EXISTS (SELECT 1 FROM public.students st WHERE st.classroom_id = _classroom_id
                 AND (st.auth_user_id = auth.uid() OR st.parent_user_id = auth.uid() OR st.parent_user_id_2 = auth.uid())));
$$;
REVOKE ALL ON FUNCTION public.get_classroom_subject_teachers(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_classroom_subject_teachers(uuid) TO authenticated, service_role;