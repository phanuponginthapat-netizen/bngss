
-- Helper: role check shorthand already exists (has_role function)

-- ============ attendance ============
DROP POLICY IF EXISTS "Auth users manage attendance" ON public.attendance;
DROP POLICY IF EXISTS "Auth users can view attendance" ON public.attendance;
DROP POLICY IF EXISTS "Auth users can view attendance" ON public.attendance;
CREATE POLICY "Auth users can view attendance" ON public.attendance FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Staff can manage attendance" ON public.attendance;
DROP POLICY IF EXISTS "Staff can manage attendance" ON public.attendance;
CREATE POLICY "Staff can manage attendance" ON public.attendance FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director') OR has_role(auth.uid(), 'teacher'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director') OR has_role(auth.uid(), 'teacher'));

-- ============ behavior_records ============
DROP POLICY IF EXISTS "Auth users manage behavior_records" ON public.behavior_records;
DROP POLICY IF EXISTS "Auth users can view behavior_records" ON public.behavior_records;
DROP POLICY IF EXISTS "Auth users can view behavior_records" ON public.behavior_records;
CREATE POLICY "Auth users can view behavior_records" ON public.behavior_records FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Staff can manage behavior_records" ON public.behavior_records;
DROP POLICY IF EXISTS "Staff can manage behavior_records" ON public.behavior_records;
CREATE POLICY "Staff can manage behavior_records" ON public.behavior_records FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director') OR has_role(auth.uid(), 'teacher'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director') OR has_role(auth.uid(), 'teacher'));

-- ============ sdq_records ============
DROP POLICY IF EXISTS "Auth users manage sdq_records" ON public.sdq_records;
DROP POLICY IF EXISTS "Auth users can view sdq_records" ON public.sdq_records;
DROP POLICY IF EXISTS "Auth users can view sdq_records" ON public.sdq_records;
CREATE POLICY "Auth users can view sdq_records" ON public.sdq_records FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Staff can manage sdq_records" ON public.sdq_records;
DROP POLICY IF EXISTS "Staff can manage sdq_records" ON public.sdq_records;
CREATE POLICY "Staff can manage sdq_records" ON public.sdq_records FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director') OR has_role(auth.uid(), 'teacher'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director') OR has_role(auth.uid(), 'teacher'));

-- ============ homeroom_records ============
DROP POLICY IF EXISTS "Auth users manage homeroom_records" ON public.homeroom_records;
DROP POLICY IF EXISTS "Auth users can view homeroom_records" ON public.homeroom_records;
DROP POLICY IF EXISTS "Auth users can view homeroom_records" ON public.homeroom_records;
CREATE POLICY "Auth users can view homeroom_records" ON public.homeroom_records FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Staff can manage homeroom_records" ON public.homeroom_records;
DROP POLICY IF EXISTS "Staff can manage homeroom_records" ON public.homeroom_records;
CREATE POLICY "Staff can manage homeroom_records" ON public.homeroom_records FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director') OR has_role(auth.uid(), 'teacher'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director') OR has_role(auth.uid(), 'teacher'));

-- ============ home_visits ============
DROP POLICY IF EXISTS "Auth users manage home_visits" ON public.home_visits;
DROP POLICY IF EXISTS "Auth users can view home_visits" ON public.home_visits;
DROP POLICY IF EXISTS "Auth users can view home_visits" ON public.home_visits;
CREATE POLICY "Auth users can view home_visits" ON public.home_visits FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Staff can manage home_visits" ON public.home_visits;
DROP POLICY IF EXISTS "Staff can manage home_visits" ON public.home_visits;
CREATE POLICY "Staff can manage home_visits" ON public.home_visits FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director') OR has_role(auth.uid(), 'teacher'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director') OR has_role(auth.uid(), 'teacher'));

-- ============ health_records ============
DROP POLICY IF EXISTS "Auth users manage health_records" ON public.health_records;
DROP POLICY IF EXISTS "Auth users can view health_records" ON public.health_records;
DROP POLICY IF EXISTS "Auth users can view health_records" ON public.health_records;
CREATE POLICY "Auth users can view health_records" ON public.health_records FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Staff can manage health_records" ON public.health_records;
DROP POLICY IF EXISTS "Staff can manage health_records" ON public.health_records;
CREATE POLICY "Staff can manage health_records" ON public.health_records FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director') OR has_role(auth.uid(), 'teacher'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director') OR has_role(auth.uid(), 'teacher'));

-- ============ early_childhood_dev ============
DROP POLICY IF EXISTS "Auth users manage early_childhood_dev" ON public.early_childhood_dev;
DROP POLICY IF EXISTS "Auth users can view early_childhood_dev" ON public.early_childhood_dev;
DROP POLICY IF EXISTS "Auth users can view early_childhood_dev" ON public.early_childhood_dev;
CREATE POLICY "Auth users can view early_childhood_dev" ON public.early_childhood_dev FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Staff can manage early_childhood_dev" ON public.early_childhood_dev;
DROP POLICY IF EXISTS "Staff can manage early_childhood_dev" ON public.early_childhood_dev;
CREATE POLICY "Staff can manage early_childhood_dev" ON public.early_childhood_dev FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director') OR has_role(auth.uid(), 'teacher'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director') OR has_role(auth.uid(), 'teacher'));

-- ============ budget_transactions ============
DROP POLICY IF EXISTS "Auth users manage budget_transactions" ON public.budget_transactions;
DROP POLICY IF EXISTS "Auth users can view budget_transactions" ON public.budget_transactions;
DROP POLICY IF EXISTS "Auth users can view budget_transactions" ON public.budget_transactions;
CREATE POLICY "Auth users can view budget_transactions" ON public.budget_transactions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin/Director can manage budget_transactions" ON public.budget_transactions;
DROP POLICY IF EXISTS "Admin/Director can manage budget_transactions" ON public.budget_transactions;
CREATE POLICY "Admin/Director can manage budget_transactions" ON public.budget_transactions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director'));

-- ============ procurement_records ============
DROP POLICY IF EXISTS "Auth users manage procurement_records" ON public.procurement_records;
DROP POLICY IF EXISTS "Auth users can view procurement_records" ON public.procurement_records;
DROP POLICY IF EXISTS "Auth users can view procurement_records" ON public.procurement_records;
CREATE POLICY "Auth users can view procurement_records" ON public.procurement_records FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin/Director can manage procurement_records" ON public.procurement_records;
DROP POLICY IF EXISTS "Admin/Director can manage procurement_records" ON public.procurement_records;
CREATE POLICY "Admin/Director can manage procurement_records" ON public.procurement_records FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director'));

-- ============ salary_records ============
DROP POLICY IF EXISTS "Auth users manage salary_records" ON public.salary_records;
DROP POLICY IF EXISTS "Auth users can view salary_records" ON public.salary_records;
DROP POLICY IF EXISTS "Auth users can view salary_records" ON public.salary_records;
CREATE POLICY "Auth users can view salary_records" ON public.salary_records FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin/Director can manage salary_records" ON public.salary_records;
DROP POLICY IF EXISTS "Admin/Director can manage salary_records" ON public.salary_records;
CREATE POLICY "Admin/Director can manage salary_records" ON public.salary_records FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director'));

-- ============ personnel ============
DROP POLICY IF EXISTS "Auth users manage personnel" ON public.personnel;
DROP POLICY IF EXISTS "Auth users can view personnel" ON public.personnel;
DROP POLICY IF EXISTS "Auth users can view personnel" ON public.personnel;
CREATE POLICY "Auth users can view personnel" ON public.personnel FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin/Director can manage personnel" ON public.personnel;
DROP POLICY IF EXISTS "Admin/Director can manage personnel" ON public.personnel;
CREATE POLICY "Admin/Director can manage personnel" ON public.personnel FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director'));

-- ============ staff_evaluations ============
DROP POLICY IF EXISTS "Auth users manage staff_evaluations" ON public.staff_evaluations;
DROP POLICY IF EXISTS "Auth users can view staff_evaluations" ON public.staff_evaluations;
DROP POLICY IF EXISTS "Auth users can view staff_evaluations" ON public.staff_evaluations;
CREATE POLICY "Auth users can view staff_evaluations" ON public.staff_evaluations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin/Director can manage staff_evaluations" ON public.staff_evaluations;
DROP POLICY IF EXISTS "Admin/Director can manage staff_evaluations" ON public.staff_evaluations;
CREATE POLICY "Admin/Director can manage staff_evaluations" ON public.staff_evaluations FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director'));

-- ============ documents ============
DROP POLICY IF EXISTS "Auth users manage documents" ON public.documents;
DROP POLICY IF EXISTS "Auth users can view documents" ON public.documents;
DROP POLICY IF EXISTS "Auth users can view documents" ON public.documents;
CREATE POLICY "Auth users can view documents" ON public.documents FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth users can create documents" ON public.documents;
DROP POLICY IF EXISTS "Auth users can create documents" ON public.documents;
CREATE POLICY "Auth users can create documents" ON public.documents FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Admin/Director can manage documents" ON public.documents;
DROP POLICY IF EXISTS "Admin/Director can manage documents" ON public.documents;
CREATE POLICY "Admin/Director can manage documents" ON public.documents FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director'));

-- ============ document_recipients ============
DROP POLICY IF EXISTS "Auth users manage document_recipients" ON public.document_recipients;
DROP POLICY IF EXISTS "Auth users can view document_recipients" ON public.document_recipients;
DROP POLICY IF EXISTS "Auth users can view document_recipients" ON public.document_recipients;
CREATE POLICY "Auth users can view document_recipients" ON public.document_recipients FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Auth users can create document_recipients" ON public.document_recipients;
DROP POLICY IF EXISTS "Auth users can create document_recipients" ON public.document_recipients;
CREATE POLICY "Auth users can create document_recipients" ON public.document_recipients FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Admin/Director can manage document_recipients" ON public.document_recipients;
DROP POLICY IF EXISTS "Admin/Director can manage document_recipients" ON public.document_recipients;
CREATE POLICY "Admin/Director can manage document_recipients" ON public.document_recipients FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director'));

-- ============ schedules ============
DROP POLICY IF EXISTS "Auth users manage schedules" ON public.schedules;
DROP POLICY IF EXISTS "Auth users can view schedules" ON public.schedules;
DROP POLICY IF EXISTS "Auth users can view schedules" ON public.schedules;
CREATE POLICY "Auth users can view schedules" ON public.schedules FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Staff can manage schedules" ON public.schedules;
DROP POLICY IF EXISTS "Staff can manage schedules" ON public.schedules;
CREATE POLICY "Staff can manage schedules" ON public.schedules FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director') OR has_role(auth.uid(), 'teacher'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director') OR has_role(auth.uid(), 'teacher'));

-- ============ enrollments ============
DROP POLICY IF EXISTS "Auth users can manage enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Auth users can view enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Auth users can view enrollments" ON public.enrollments;
CREATE POLICY "Auth users can view enrollments" ON public.enrollments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Staff can manage enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Staff can manage enrollments" ON public.enrollments;
CREATE POLICY "Staff can manage enrollments" ON public.enrollments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director') OR has_role(auth.uid(), 'teacher'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director') OR has_role(auth.uid(), 'teacher'));

-- ============ classrooms ============
DROP POLICY IF EXISTS "Auth users can manage classrooms" ON public.classrooms;
DROP POLICY IF EXISTS "Auth users can view classrooms" ON public.classrooms;
DROP POLICY IF EXISTS "Auth users can view classrooms" ON public.classrooms;
CREATE POLICY "Auth users can view classrooms" ON public.classrooms FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Staff can manage classrooms" ON public.classrooms;
DROP POLICY IF EXISTS "Staff can manage classrooms" ON public.classrooms;
CREATE POLICY "Staff can manage classrooms" ON public.classrooms FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director') OR has_role(auth.uid(), 'teacher'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director') OR has_role(auth.uid(), 'teacher'));

-- ============ news_posts ============
DROP POLICY IF EXISTS "Auth users manage news_posts" ON public.news_posts;
DROP POLICY IF EXISTS "Auth users can view news_posts" ON public.news_posts;
DROP POLICY IF EXISTS "Auth users can view news_posts" ON public.news_posts;
CREATE POLICY "Auth users can view news_posts" ON public.news_posts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin/Director can manage news_posts" ON public.news_posts;
DROP POLICY IF EXISTS "Admin/Director can manage news_posts" ON public.news_posts;
CREATE POLICY "Admin/Director can manage news_posts" ON public.news_posts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director'));

-- ============ emergency_broadcasts ============
DROP POLICY IF EXISTS "Auth users manage emergency_broadcasts" ON public.emergency_broadcasts;
DROP POLICY IF EXISTS "Auth users can view emergency_broadcasts" ON public.emergency_broadcasts;
DROP POLICY IF EXISTS "Auth users can view emergency_broadcasts" ON public.emergency_broadcasts;
CREATE POLICY "Auth users can view emergency_broadcasts" ON public.emergency_broadcasts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin/Director can manage emergency_broadcasts" ON public.emergency_broadcasts;
DROP POLICY IF EXISTS "Admin/Director can manage emergency_broadcasts" ON public.emergency_broadcasts;
CREATE POLICY "Admin/Director can manage emergency_broadcasts" ON public.emergency_broadcasts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director'));

-- ============ homework_assignments ============
DROP POLICY IF EXISTS "Auth users manage homework_assignments" ON public.homework_assignments;
DROP POLICY IF EXISTS "Auth users can view homework_assignments" ON public.homework_assignments;
DROP POLICY IF EXISTS "Auth users can view homework_assignments" ON public.homework_assignments;
CREATE POLICY "Auth users can view homework_assignments" ON public.homework_assignments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Staff can manage homework_assignments" ON public.homework_assignments;
DROP POLICY IF EXISTS "Staff can manage homework_assignments" ON public.homework_assignments;
CREATE POLICY "Staff can manage homework_assignments" ON public.homework_assignments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director') OR has_role(auth.uid(), 'teacher'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director') OR has_role(auth.uid(), 'teacher'));

-- ============ admissions ============
DROP POLICY IF EXISTS "Auth users manage admissions" ON public.admissions;
DROP POLICY IF EXISTS "Auth users can view admissions" ON public.admissions;
DROP POLICY IF EXISTS "Auth users can view admissions" ON public.admissions;
CREATE POLICY "Auth users can view admissions" ON public.admissions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin/Director can manage admissions" ON public.admissions;
DROP POLICY IF EXISTS "Admin/Director can manage admissions" ON public.admissions;
CREATE POLICY "Admin/Director can manage admissions" ON public.admissions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director'));

-- ============ assessment_criteria ============
DROP POLICY IF EXISTS "Auth users manage assessment_criteria" ON public.assessment_criteria;
DROP POLICY IF EXISTS "Auth users can view assessment_criteria" ON public.assessment_criteria;
DROP POLICY IF EXISTS "Auth users can view assessment_criteria" ON public.assessment_criteria;
CREATE POLICY "Auth users can view assessment_criteria" ON public.assessment_criteria FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin/Director can manage assessment_criteria" ON public.assessment_criteria;
DROP POLICY IF EXISTS "Admin/Director can manage assessment_criteria" ON public.assessment_criteria;
CREATE POLICY "Admin/Director can manage assessment_criteria" ON public.assessment_criteria FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director'));

-- ============ assets ============
DROP POLICY IF EXISTS "Auth users manage assets" ON public.assets;
DROP POLICY IF EXISTS "Auth users can view assets" ON public.assets;
DROP POLICY IF EXISTS "Auth users can view assets" ON public.assets;
CREATE POLICY "Auth users can view assets" ON public.assets FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin/Director can manage assets" ON public.assets;
DROP POLICY IF EXISTS "Admin/Director can manage assets" ON public.assets;
CREATE POLICY "Admin/Director can manage assets" ON public.assets FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director'));

-- ============ id_plan_records ============
DROP POLICY IF EXISTS "Auth users manage id_plan_records" ON public.id_plan_records;
DROP POLICY IF EXISTS "Auth users can view id_plan_records" ON public.id_plan_records;
DROP POLICY IF EXISTS "Auth users can view id_plan_records" ON public.id_plan_records;
CREATE POLICY "Auth users can view id_plan_records" ON public.id_plan_records FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Staff can manage id_plan_records" ON public.id_plan_records;
DROP POLICY IF EXISTS "Staff can manage id_plan_records" ON public.id_plan_records;
CREATE POLICY "Staff can manage id_plan_records" ON public.id_plan_records FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director') OR has_role(auth.uid(), 'teacher'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director') OR has_role(auth.uid(), 'teacher'));

-- ============ Performance: Add indexes ============
CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON public.attendance (student_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_academic_year ON public.attendance (academic_year, semester);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON public.enrollments (student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_classroom ON public.enrollments (classroom_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_subject ON public.enrollments (subject_id);
CREATE INDEX IF NOT EXISTS idx_schedules_classroom ON public.schedules (classroom_id, academic_year, semester);
CREATE INDEX IF NOT EXISTS idx_behavior_records_student ON public.behavior_records (student_id, record_date);
CREATE INDEX IF NOT EXISTS idx_homeroom_records_classroom ON public.homeroom_records (classroom_id, academic_year);
CREATE INDEX IF NOT EXISTS idx_home_visits_student ON public.home_visits (student_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications (user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_documents_date ON public.documents (doc_date, status);
CREATE INDEX IF NOT EXISTS idx_personnel_user ON public.personnel (user_id);
CREATE INDEX IF NOT EXISTS idx_salary_personnel ON public.salary_records (personnel_id, salary_year, salary_month);
