-- 2026-08-17 — ตรวจสิทธิ์ทุก role และปิดช่องโหว่ RLS
-- ปัญหาที่พบ (จำลอง session จริงของ admin/director/teacher/student/observer):
--   1) นโยบายเก่าชื่อ "Auth users ..." ที่ใช้ qual = true ทำให้ "ผู้ใช้ที่ล็อกอินคนใดก็ได้"
--      (รวมนักเรียน/ผู้ปกครอง) อ่าน+เขียนตารางอ่อนไหวได้ เช่น personnel, students, enrollments,
--      salary_records, health_records, sdq_records, home_visits, staff_evaluations ฯลฯ
--   2) นโยบาย "School users view own school ..." ลืมเช็คว่าเป็นบุคลากร → นักเรียนเห็นข้อมูลทั้งโรงเรียน
--   3) app_secrets / ai_provider_keys เปิดให้ director (และ observer ที่ได้สิทธิ์ director) อ่าน key ได้

do $mig$
declare r record; t text; p text;
begin
  for r in
    select tablename, policyname from pg_policies
    where schemaname='public' and permissive='PERMISSIVE'
      and roles::text like '%authenticated%'
      and coalesce(qual,'true')='true' and coalesce(with_check,'true')='true'
      and (policyname ilike 'Auth users%' or policyname ilike 'Authenticated %')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;

  drop policy if exists "Admins can manage cms settings" on public.cms_settings;
  drop policy if exists "Auth view all cms settings" on public.cms_settings;
  drop policy if exists "admins can delete devices" on public.kiosk_devices;
  drop policy if exists "ID plan records restricted view" on public.id_plan_records;
  drop policy if exists "pp5 insert owner or admin" on public.pp5_files;
  drop policy if exists "Auth users view academic events" on public.academic_events;

  drop policy if exists "Personnel dept head can insert salary_records" on public.salary_records;
  create policy "Personnel dept head insert salary_records" on public.salary_records
    for insert to authenticated
    with check (public.has_dept_position(auth.uid(),'personnel'::public.school_department,'head'::public.dept_position));

  drop policy if exists "student_offsite_photos_staff_all" on public.student_offsite_photos;
  create policy "offsite_photos_staff_manage" on public.student_offsite_photos for all to authenticated
    using (public.is_staff_user(auth.uid())) with check (public.is_staff_user(auth.uid()));

  drop policy if exists "participants_teacher_manage" on public.student_offsite_participants;
  create policy "offsite_participants_staff_manage" on public.student_offsite_participants for all to authenticated
    using (public.is_staff_user(auth.uid())) with check (public.is_staff_user(auth.uid()));

  -- อ่านได้เฉพาะบุคลากร
  drop policy if exists "dir_sig read auth" on public.director_signatures;
  create policy "dir_sig read staff" on public.director_signatures for select to authenticated
    using (public.is_staff_user(auth.uid()));
  drop policy if exists "vault_groups_read_authenticated" on public.line_vault_groups;
  create policy "vault_groups_read_staff" on public.line_vault_groups for select to authenticated
    using (public.is_staff_user(auth.uid()));
  drop policy if exists "All authenticated can read fill history" on public.template_fill_history;
  create policy "Staff read fill history" on public.template_fill_history for select to authenticated
    using (public.is_staff_user(auth.uid()));
  drop policy if exists "Auth read versions" on public.print_template_versions;
  create policy "Staff read template versions" on public.print_template_versions for select to authenticated
    using (public.is_staff_user(auth.uid()));

  foreach p in array array[
    'students|School users view own school students',
    'personnel|School users view own school personnel',
    'attendance|School staff view own school attendance',
    'behavior_records|School staff view own school behavior',
    'budget_transactions|School staff view own school budget',
    'assets|School users view own school assets',
    'enrollments|School users view own school enrollments',
    'documents|School users view own school documents',
    'hub_projects|view projects in school',
    'learning_center_bookings|LCB viewable by same school'
  ] loop
    t := split_part(p,'|',1);
    execute format('drop policy if exists %I on public.%I', split_part(p,'|',2), t);
    execute format($f$create policy staff_view_own_school on public.%I for select to authenticated
      using (public.is_staff_user(auth.uid())
             and (school_id is null or school_id = public.get_user_school_id(auth.uid())))$f$, t);
  end loop;

  -- ความลับ/คีย์ API = admin เท่านั้น
  drop policy if exists "admin manage app_secrets" on public.app_secrets;
  drop policy if exists "admins manage app secrets" on public.app_secrets;
  drop policy if exists "app_secrets admin read" on public.app_secrets;
  create policy "app_secrets admin only" on public.app_secrets for all to authenticated
    using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

  drop policy if exists "Admins manage ai provider keys" on public.ai_provider_keys;
  drop policy if exists "Admins manage ai_provider_keys" on public.ai_provider_keys;
  drop policy if exists "admin manage ai_provider_keys" on public.ai_provider_keys;
  create policy "ai_provider_keys admin only" on public.ai_provider_keys for all to authenticated
    using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

  drop policy if exists "admin manage district_api_keys" on public.district_api_keys;
  drop policy if exists "admin manage game_hub_api_keys" on public.game_hub_api_keys;
end $mig$;
