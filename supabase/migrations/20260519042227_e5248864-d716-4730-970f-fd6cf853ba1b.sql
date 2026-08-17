-- 1) audit_logs
DROP POLICY IF EXISTS "Auth users can insert audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Users insert own audit_logs" ON public.audit_logs;
CREATE POLICY "Users insert own audit_logs"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 2) asset_damage_reports
DROP POLICY IF EXISTS "Auth users can view damage reports" ON public.asset_damage_reports;
DROP POLICY IF EXISTS "Staff view damage reports" ON public.asset_damage_reports;
CREATE POLICY "Staff view damage reports"
  ON public.asset_damage_reports FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director')
    OR has_role(auth.uid(),'teacher')
    OR reported_by_user_id = auth.uid()
  );

-- 3) student_subsidies
DROP POLICY IF EXISTS "Staff can manage student_subsidies" ON public.student_subsidies;
DROP POLICY IF EXISTS "Teachers can view student_subsidies" ON public.student_subsidies;
DROP POLICY IF EXISTS "Staff can view student_subsidies" ON public.student_subsidies;
DROP POLICY IF EXISTS "Admin/Director manage student_subsidies" ON public.student_subsidies;
CREATE POLICY "Admin/Director manage student_subsidies"
  ON public.student_subsidies FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director'));
DROP POLICY IF EXISTS "Students view own subsidies" ON public.student_subsidies;
CREATE POLICY "Students view own subsidies"
  ON public.student_subsidies FOR SELECT TO authenticated
  USING (student_id IN (SELECT id FROM students WHERE auth_user_id = auth.uid()));
DROP POLICY IF EXISTS "Parents view linked subsidies" ON public.student_subsidies;
CREATE POLICY "Parents view linked subsidies"
  ON public.student_subsidies FOR SELECT TO authenticated
  USING (student_id IN (SELECT student_id FROM parent_student_links WHERE parent_user_id = auth.uid()));

-- 4) student_face_descriptors
DROP POLICY IF EXISTS "staff manage face descriptors" ON public.student_face_descriptors;
DROP POLICY IF EXISTS "Staff can manage face descriptors" ON public.student_face_descriptors;
DROP POLICY IF EXISTS "Teachers manage face descriptors" ON public.student_face_descriptors;
DROP POLICY IF EXISTS "Admin/Director manage face descriptors" ON public.student_face_descriptors;
CREATE POLICY "Admin/Director manage face descriptors"
  ON public.student_face_descriptors FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director'));

-- 5) home_visits
DROP POLICY IF EXISTS "Staff can manage home_visits" ON public.home_visits;
DROP POLICY IF EXISTS "Admin/Director manage home_visits" ON public.home_visits;
CREATE POLICY "Admin/Director manage home_visits"
  ON public.home_visits FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director'));
DROP POLICY IF EXISTS "Homeroom teacher manage home_visits" ON public.home_visits;
CREATE POLICY "Homeroom teacher manage home_visits"
  ON public.home_visits FOR ALL TO authenticated
  USING (
    has_role(auth.uid(),'teacher') AND student_id IN (
      SELECT s.id FROM students s
      JOIN classrooms c ON c.id = s.classroom_id
      JOIN personnel p ON p.user_id = auth.uid()
      WHERE c.homeroom_teacher IN (
        CONCAT(p.prefix, p.first_name, ' ', p.last_name),
        CONCAT(p.first_name, ' ', p.last_name)
      )
    )
  )
  WITH CHECK (
    has_role(auth.uid(),'teacher') AND student_id IN (
      SELECT s.id FROM students s
      JOIN classrooms c ON c.id = s.classroom_id
      JOIN personnel p ON p.user_id = auth.uid()
      WHERE c.homeroom_teacher IN (
        CONCAT(p.prefix, p.first_name, ' ', p.last_name),
        CONCAT(p.first_name, ' ', p.last_name)
      )
    )
  );

-- 6) iot_devices
DROP POLICY IF EXISTS "Staff can view iot devices" ON public.iot_devices;
DROP POLICY IF EXISTS "Admins can update iot devices" ON public.iot_devices;
DROP POLICY IF EXISTS "Admin/Director view iot devices" ON public.iot_devices;
CREATE POLICY "Admin/Director view iot devices"
  ON public.iot_devices FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director'));
DROP POLICY IF EXISTS "Admin/Director update iot devices" ON public.iot_devices;
CREATE POLICY "Admin/Director update iot devices"
  ON public.iot_devices FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'director'));

-- 7) students_safe view (ตัด PII ออก)
CREATE OR REPLACE VIEW public.students_safe
WITH (security_invoker=on) AS
SELECT 
  id, student_code, prefix, first_name, last_name,
  gender, date_of_birth, classroom_id, status, photo_url,
  blood_type, religion, nationality, ethnicity,
  father_name, father_phone, father_occupation,
  mother_name, mother_phone, mother_occupation,
  guardian_name, guardian_phone, guardian_relation,
  emergency_contact, emergency_phone,
  address, phone, weight, height, special_needs,
  birth_province, previous_school, admission_date,
  graduated_at, graduation_year, graduation_gpa, graduation_level,
  school_id, auth_user_id, created_at, updated_at
FROM public.students;