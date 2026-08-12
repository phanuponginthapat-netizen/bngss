-- ===== helper shortcut =====
-- uses existing public._staff_check(uuid), public.has_role(uuid, app_role), public.is_admin_or_director()

-- ===== garbage bank =====
CREATE POLICY "garbage_deposits_staff_write" ON public.garbage_deposits
  FOR INSERT TO authenticated WITH CHECK (public._staff_check(auth.uid()));
CREATE POLICY "garbage_deposits_staff_update" ON public.garbage_deposits
  FOR UPDATE TO authenticated USING (public._staff_check(auth.uid())) WITH CHECK (public._staff_check(auth.uid()));
CREATE POLICY "garbage_deposits_staff_delete" ON public.garbage_deposits
  FOR DELETE TO authenticated USING (public._staff_check(auth.uid()));
CREATE POLICY "garbage_deposits_staff_select" ON public.garbage_deposits
  FOR SELECT TO authenticated USING (public._staff_check(auth.uid()));

CREATE POLICY "garbage_redemptions_staff_write" ON public.garbage_redemptions
  FOR INSERT TO authenticated WITH CHECK (public._staff_check(auth.uid()));
CREATE POLICY "garbage_redemptions_staff_update" ON public.garbage_redemptions
  FOR UPDATE TO authenticated USING (public._staff_check(auth.uid())) WITH CHECK (public._staff_check(auth.uid()));
CREATE POLICY "garbage_redemptions_staff_delete" ON public.garbage_redemptions
  FOR DELETE TO authenticated USING (public._staff_check(auth.uid()));
CREATE POLICY "garbage_redemptions_staff_select" ON public.garbage_redemptions
  FOR SELECT TO authenticated USING (public._staff_check(auth.uid()));

-- ===== task assignments (homework) =====
CREATE POLICY "task_assignments_staff_insert" ON public.task_assignments
  FOR INSERT TO authenticated WITH CHECK (public._staff_check(auth.uid()) AND (assigned_by IS NULL OR assigned_by = auth.uid()));
CREATE POLICY "task_assignments_owner_update" ON public.task_assignments
  FOR UPDATE TO authenticated USING (assigned_by = auth.uid() OR public.is_admin_or_director())
  WITH CHECK (assigned_by = auth.uid() OR public.is_admin_or_director());
CREATE POLICY "task_assignments_owner_delete" ON public.task_assignments
  FOR DELETE TO authenticated USING (assigned_by = auth.uid() OR public.is_admin_or_director());
CREATE POLICY "task_assignments_staff_select" ON public.task_assignments
  FOR SELECT TO authenticated USING (public._staff_check(auth.uid()));

-- ===== padlet boards =====
CREATE POLICY "padlet_boards_insert_own" ON public.padlet_boards
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "padlet_boards_update_own" ON public.padlet_boards
  FOR UPDATE TO authenticated USING (owner_id = auth.uid() OR public.is_admin_or_director())
  WITH CHECK (owner_id = auth.uid() OR public.is_admin_or_director());
CREATE POLICY "padlet_boards_delete_own" ON public.padlet_boards
  FOR DELETE TO authenticated USING (owner_id = auth.uid() OR public.is_admin_or_director());

-- ===== game scores =====
CREATE POLICY "scores_insert_own" ON public.game_hub_scores
  FOR INSERT TO authenticated WITH CHECK (auth_user_id = auth.uid());

-- ===== social posts (admin managed) =====
CREATE POLICY "social_posts_admin_write" ON public.social_posts
  FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_director());
CREATE POLICY "social_posts_admin_update" ON public.social_posts
  FOR UPDATE TO authenticated USING (public.is_admin_or_director()) WITH CHECK (public.is_admin_or_director());
CREATE POLICY "social_posts_admin_delete" ON public.social_posts
  FOR DELETE TO authenticated USING (public.is_admin_or_director());

-- ===== user roles (admin only) =====
CREATE POLICY "user_roles_admin_insert" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "user_roles_admin_update" ON public.user_roles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "user_roles_admin_delete" ON public.user_roles
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ===== inbox items =====
CREATE POLICY "inbox_insert_own" ON public.inbox_items
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ===== passkeys =====
CREATE POLICY "webauthn_insert_own" ON public.webauthn_credentials
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "webauthn_update_own" ON public.webauthn_credentials
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ===== teaching reflection attachments =====
CREATE POLICY "refl_attach_insert_staff" ON public.teaching_reflection_attachments
  FOR INSERT TO authenticated WITH CHECK (public._staff_check(auth.uid()));
CREATE POLICY "refl_attach_delete_staff" ON public.teaching_reflection_attachments
  FOR DELETE TO authenticated USING (public._staff_check(auth.uid()));

-- ===== tuition invoices (staff manage) =====
CREATE POLICY "tuition_staff_insert" ON public.tuition_invoices
  FOR INSERT TO authenticated WITH CHECK (public._staff_check(auth.uid()));
CREATE POLICY "tuition_staff_update" ON public.tuition_invoices
  FOR UPDATE TO authenticated USING (public._staff_check(auth.uid())) WITH CHECK (public._staff_check(auth.uid()));
CREATE POLICY "tuition_staff_delete" ON public.tuition_invoices
  FOR DELETE TO authenticated USING (public.is_admin_or_director());
CREATE POLICY "tuition_staff_select" ON public.tuition_invoices
  FOR SELECT TO authenticated USING (public._staff_check(auth.uid()));

-- ===== storage gaps =====
CREATE POLICY "chat attachments read own" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'chat-attachments');
CREATE POLICY "homework files read auth" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'homework-files');
CREATE POLICY "homework files delete owner" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'homework-files' AND owner = auth.uid());
CREATE POLICY "ict loan photos staff upload" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'ict-loan-photos' AND public._staff_check(auth.uid()));
CREATE POLICY "learning content staff upload" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'learning-content' AND public._staff_check(auth.uid()));
CREATE POLICY "learning content owner update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'learning-content' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'learning-content' AND owner = auth.uid());
CREATE POLICY "learning content owner delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'learning-content' AND (owner = auth.uid() OR public.is_admin_or_director()));
CREATE POLICY "teaching reflections read staff" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'teaching-reflections' AND public._staff_check(auth.uid()));
CREATE POLICY "teaching reflections delete owner" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'teaching-reflections' AND (owner = auth.uid() OR public.is_admin_or_director()));