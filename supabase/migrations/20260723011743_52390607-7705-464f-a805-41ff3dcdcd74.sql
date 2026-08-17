
-- dashboard_shortcuts
DROP POLICY IF EXISTS "shortcuts read auth" ON public.dashboard_shortcuts;
CREATE POLICY "shortcuts read auth" ON public.dashboard_shortcuts FOR SELECT TO authenticated USING (is_active = true OR public.is_admin_or_director());
DROP POLICY IF EXISTS "shortcuts manage admin" ON public.dashboard_shortcuts;
CREATE POLICY "shortcuts manage admin" ON public.dashboard_shortcuts FOR ALL TO authenticated USING (public.is_admin_or_director()) WITH CHECK (public.is_admin_or_director());

-- game_hub_games
DROP POLICY IF EXISTS "games read auth" ON public.game_hub_games;
CREATE POLICY "games read auth" ON public.game_hub_games FOR SELECT TO authenticated USING (is_active = true OR public.is_admin_or_director());
DROP POLICY IF EXISTS "games manage admin" ON public.game_hub_games;
CREATE POLICY "games manage admin" ON public.game_hub_games FOR ALL TO authenticated USING (public.is_admin_or_director()) WITH CHECK (public.is_admin_or_director());

-- teaching_reflections
DROP POLICY IF EXISTS "reflections owner" ON public.teaching_reflections;
CREATE POLICY "reflections owner" ON public.teaching_reflections FOR ALL TO authenticated
  USING (teacher_id = auth.uid() OR public.is_admin_or_director())
  WITH CHECK (teacher_id = auth.uid() OR public.is_admin_or_director());

-- home_visit_summaries
DROP POLICY IF EXISTS "home_visit_sum read staff" ON public.home_visit_summaries;
CREATE POLICY "home_visit_sum read staff" ON public.home_visit_summaries FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'teacher') OR public.is_admin_or_director());
DROP POLICY IF EXISTS "home_visit_sum write staff" ON public.home_visit_summaries;
CREATE POLICY "home_visit_sum write staff" ON public.home_visit_summaries FOR ALL TO authenticated
  USING (created_by = auth.uid() OR public.is_admin_or_director())
  WITH CHECK (created_by = auth.uid() OR public.is_admin_or_director());

-- fitness_rewards
DROP POLICY IF EXISTS "fitness_rewards read auth" ON public.fitness_rewards;
CREATE POLICY "fitness_rewards read auth" ON public.fitness_rewards FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "fitness_rewards manage admin" ON public.fitness_rewards;
CREATE POLICY "fitness_rewards manage admin" ON public.fitness_rewards FOR ALL TO authenticated USING (public.is_admin_or_director()) WITH CHECK (public.is_admin_or_director());

-- director_signatures
DROP POLICY IF EXISTS "dir_sig read auth" ON public.director_signatures;
CREATE POLICY "dir_sig read auth" ON public.director_signatures FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "dir_sig manage admin" ON public.director_signatures;
CREATE POLICY "dir_sig manage admin" ON public.director_signatures FOR ALL TO authenticated USING (public.is_admin_or_director()) WITH CHECK (public.is_admin_or_director());

-- iot_devices
DROP POLICY IF EXISTS "iot read auth" ON public.iot_devices;
CREATE POLICY "iot read auth" ON public.iot_devices FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "iot manage admin" ON public.iot_devices;
CREATE POLICY "iot manage admin" ON public.iot_devices FOR ALL TO authenticated USING (public.is_admin_or_director()) WITH CHECK (public.is_admin_or_director());

-- schools
DROP POLICY IF EXISTS "schools read auth" ON public.schools;
CREATE POLICY "schools read auth" ON public.schools FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "schools manage admin" ON public.schools;
CREATE POLICY "schools manage admin" ON public.schools FOR ALL TO authenticated USING (public.is_admin_or_director()) WITH CHECK (public.is_admin_or_director());

-- pp5_files
DROP POLICY IF EXISTS "pp5 owner and admin" ON public.pp5_files;
CREATE POLICY "pp5 owner and admin" ON public.pp5_files FOR ALL TO authenticated
  USING (uploaded_by = auth.uid() OR public.is_admin_or_director())
  WITH CHECK (uploaded_by = auth.uid() OR public.is_admin_or_director());
DROP POLICY IF EXISTS "pp5 read staff" ON public.pp5_files;
CREATE POLICY "pp5 read staff" ON public.pp5_files FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'teacher') OR public.is_admin_or_director());

-- pp6_files
DROP POLICY IF EXISTS "pp6 owner and admin" ON public.pp6_files;
CREATE POLICY "pp6 owner and admin" ON public.pp6_files FOR ALL TO authenticated
  USING (uploaded_by = auth.uid() OR public.is_admin_or_director())
  WITH CHECK (uploaded_by = auth.uid() OR public.is_admin_or_director());
DROP POLICY IF EXISTS "pp6 read staff" ON public.pp6_files;
CREATE POLICY "pp6 read staff" ON public.pp6_files FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'teacher') OR public.is_admin_or_director());
