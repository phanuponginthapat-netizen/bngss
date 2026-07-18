
-- =============================================
-- 1) DROP & RECREATE FOREIGN KEYS WITH CASCADE
-- =============================================

-- attendance -> students
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_student_id_fkey;
ALTER TABLE public.attendance ADD CONSTRAINT attendance_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

-- attendance -> subjects
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_subject_id_fkey;
ALTER TABLE public.attendance ADD CONSTRAINT attendance_subject_id_fkey
  FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;

-- behavior_records -> students
ALTER TABLE public.behavior_records DROP CONSTRAINT IF EXISTS behavior_records_student_id_fkey;
ALTER TABLE public.behavior_records ADD CONSTRAINT behavior_records_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

-- early_childhood_dev -> students
ALTER TABLE public.early_childhood_dev DROP CONSTRAINT IF EXISTS early_childhood_dev_student_id_fkey;
ALTER TABLE public.early_childhood_dev ADD CONSTRAINT early_childhood_dev_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

-- enrollments -> students
ALTER TABLE public.enrollments DROP CONSTRAINT IF EXISTS enrollments_student_id_fkey;
ALTER TABLE public.enrollments ADD CONSTRAINT enrollments_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

-- enrollments -> subjects
ALTER TABLE public.enrollments DROP CONSTRAINT IF EXISTS enrollments_subject_id_fkey;
ALTER TABLE public.enrollments ADD CONSTRAINT enrollments_subject_id_fkey
  FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;

-- enrollments -> classrooms
ALTER TABLE public.enrollments DROP CONSTRAINT IF EXISTS enrollments_classroom_id_fkey;
ALTER TABLE public.enrollments ADD CONSTRAINT enrollments_classroom_id_fkey
  FOREIGN KEY (classroom_id) REFERENCES public.classrooms(id) ON DELETE CASCADE;

-- home_visits -> students
ALTER TABLE public.home_visits DROP CONSTRAINT IF EXISTS home_visits_student_id_fkey;
ALTER TABLE public.home_visits ADD CONSTRAINT home_visits_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

-- home_visits -> classrooms
ALTER TABLE public.home_visits DROP CONSTRAINT IF EXISTS home_visits_classroom_id_fkey;
ALTER TABLE public.home_visits ADD CONSTRAINT home_visits_classroom_id_fkey
  FOREIGN KEY (classroom_id) REFERENCES public.classrooms(id) ON DELETE SET NULL;

-- homeroom_records -> students
ALTER TABLE public.homeroom_records DROP CONSTRAINT IF EXISTS homeroom_records_student_id_fkey;
ALTER TABLE public.homeroom_records ADD CONSTRAINT homeroom_records_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

-- homeroom_records -> classrooms
ALTER TABLE public.homeroom_records DROP CONSTRAINT IF EXISTS homeroom_records_classroom_id_fkey;
ALTER TABLE public.homeroom_records ADD CONSTRAINT homeroom_records_classroom_id_fkey
  FOREIGN KEY (classroom_id) REFERENCES public.classrooms(id) ON DELETE SET NULL;

-- health_records -> students
ALTER TABLE public.health_records DROP CONSTRAINT IF EXISTS health_records_student_id_fkey;
ALTER TABLE public.health_records ADD CONSTRAINT health_records_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

-- student_leaves -> students
ALTER TABLE public.student_leaves DROP CONSTRAINT IF EXISTS student_leaves_student_id_fkey;
ALTER TABLE public.student_leaves ADD CONSTRAINT student_leaves_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

-- student_screenings -> students
ALTER TABLE public.student_screenings DROP CONSTRAINT IF EXISTS student_screenings_student_id_fkey;
ALTER TABLE public.student_screenings ADD CONSTRAINT student_screenings_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

-- student_subsidies -> students
ALTER TABLE public.student_subsidies DROP CONSTRAINT IF EXISTS student_subsidies_student_id_fkey;
ALTER TABLE public.student_subsidies ADD CONSTRAINT student_subsidies_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

-- sdq_records -> students
ALTER TABLE public.sdq_records DROP CONSTRAINT IF EXISTS sdq_records_student_id_fkey;
ALTER TABLE public.sdq_records ADD CONSTRAINT sdq_records_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

-- student_assessment_scores -> students
ALTER TABLE public.student_assessment_scores DROP CONSTRAINT IF EXISTS student_assessment_scores_student_id_fkey;
ALTER TABLE public.student_assessment_scores ADD CONSTRAINT student_assessment_scores_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

-- student_assessment_scores -> assessment_criteria
ALTER TABLE public.student_assessment_scores DROP CONSTRAINT IF EXISTS student_assessment_scores_criteria_id_fkey;
ALTER TABLE public.student_assessment_scores ADD CONSTRAINT student_assessment_scores_criteria_id_fkey
  FOREIGN KEY (criteria_id) REFERENCES public.assessment_criteria(id) ON DELETE CASCADE;

-- student_column_scores -> students
ALTER TABLE public.student_column_scores DROP CONSTRAINT IF EXISTS student_column_scores_student_id_fkey;
ALTER TABLE public.student_column_scores ADD CONSTRAINT student_column_scores_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

-- student_column_scores -> subject_score_columns
ALTER TABLE public.student_column_scores DROP CONSTRAINT IF EXISTS student_column_scores_column_id_fkey;
ALTER TABLE public.student_column_scores ADD CONSTRAINT student_column_scores_column_id_fkey
  FOREIGN KEY (column_id) REFERENCES public.subject_score_columns(id) ON DELETE CASCADE;

-- student_scores -> subjects
ALTER TABLE public.student_scores DROP CONSTRAINT IF EXISTS student_scores_subject_id_fkey;
ALTER TABLE public.student_scores ADD CONSTRAINT student_scores_subject_id_fkey
  FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;

-- staff_leaves -> personnel
ALTER TABLE public.staff_leaves DROP CONSTRAINT IF EXISTS staff_leaves_personnel_id_fkey;
ALTER TABLE public.staff_leaves ADD CONSTRAINT staff_leaves_personnel_id_fkey
  FOREIGN KEY (personnel_id) REFERENCES public.personnel(id) ON DELETE CASCADE;

-- staff_evaluations -> personnel
ALTER TABLE public.staff_evaluations DROP CONSTRAINT IF EXISTS staff_evaluations_personnel_id_fkey;
ALTER TABLE public.staff_evaluations ADD CONSTRAINT staff_evaluations_personnel_id_fkey
  FOREIGN KEY (personnel_id) REFERENCES public.personnel(id) ON DELETE CASCADE;

-- salary_records -> personnel
ALTER TABLE public.salary_records DROP CONSTRAINT IF EXISTS salary_records_personnel_id_fkey;
ALTER TABLE public.salary_records ADD CONSTRAINT salary_records_personnel_id_fkey
  FOREIGN KEY (personnel_id) REFERENCES public.personnel(id) ON DELETE CASCADE;

-- id_plan_records -> personnel
ALTER TABLE public.id_plan_records DROP CONSTRAINT IF EXISTS id_plan_records_personnel_id_fkey;
ALTER TABLE public.id_plan_records ADD CONSTRAINT id_plan_records_personnel_id_fkey
  FOREIGN KEY (personnel_id) REFERENCES public.personnel(id) ON DELETE CASCADE;

-- schedules -> classrooms
ALTER TABLE public.schedules DROP CONSTRAINT IF EXISTS schedules_classroom_id_fkey;
ALTER TABLE public.schedules ADD CONSTRAINT schedules_classroom_id_fkey
  FOREIGN KEY (classroom_id) REFERENCES public.classrooms(id) ON DELETE CASCADE;

-- schedules -> subjects
ALTER TABLE public.schedules DROP CONSTRAINT IF EXISTS schedules_subject_id_fkey;
ALTER TABLE public.schedules ADD CONSTRAINT schedules_subject_id_fkey
  FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;

-- homework_assignments -> classrooms
ALTER TABLE public.homework_assignments DROP CONSTRAINT IF EXISTS homework_assignments_classroom_id_fkey;
ALTER TABLE public.homework_assignments ADD CONSTRAINT homework_assignments_classroom_id_fkey
  FOREIGN KEY (classroom_id) REFERENCES public.classrooms(id) ON DELETE CASCADE;

-- homework_assignments -> subjects
ALTER TABLE public.homework_assignments DROP CONSTRAINT IF EXISTS homework_assignments_subject_id_fkey;
ALTER TABLE public.homework_assignments ADD CONSTRAINT homework_assignments_subject_id_fkey
  FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;

-- document_recipients -> documents
ALTER TABLE public.document_recipients DROP CONSTRAINT IF EXISTS document_recipients_document_id_fkey;
ALTER TABLE public.document_recipients ADD CONSTRAINT document_recipients_document_id_fkey
  FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;

-- cms_menu_items -> cms_pages
ALTER TABLE public.cms_menu_items DROP CONSTRAINT IF EXISTS cms_menu_items_page_id_fkey;
ALTER TABLE public.cms_menu_items ADD CONSTRAINT cms_menu_items_page_id_fkey
  FOREIGN KEY (page_id) REFERENCES public.cms_pages(id) ON DELETE SET NULL;

-- subject_indicators -> subjects
ALTER TABLE public.subject_indicators DROP CONSTRAINT IF EXISTS subject_indicators_subject_id_fkey;
ALTER TABLE public.subject_indicators ADD CONSTRAINT subject_indicators_subject_id_fkey
  FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;

-- subject_score_columns -> subjects
ALTER TABLE public.subject_score_columns DROP CONSTRAINT IF EXISTS subject_score_columns_subject_id_fkey;
ALTER TABLE public.subject_score_columns ADD CONSTRAINT subject_score_columns_subject_id_fkey
  FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;

-- substitute_teaching -> classrooms
ALTER TABLE public.substitute_teaching DROP CONSTRAINT IF EXISTS substitute_teaching_classroom_id_fkey;
ALTER TABLE public.substitute_teaching ADD CONSTRAINT substitute_teaching_classroom_id_fkey
  FOREIGN KEY (classroom_id) REFERENCES public.classrooms(id) ON DELETE SET NULL;

-- substitute_teaching -> subjects
ALTER TABLE public.substitute_teaching DROP CONSTRAINT IF EXISTS substitute_teaching_subject_id_fkey;
ALTER TABLE public.substitute_teaching ADD CONSTRAINT substitute_teaching_subject_id_fkey
  FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE SET NULL;

-- =============================================
-- 2) ENABLE REALTIME ON ALL KEY TABLES
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.students;
ALTER PUBLICATION supabase_realtime ADD TABLE public.personnel;
ALTER PUBLICATION supabase_realtime ADD TABLE public.classrooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;
ALTER PUBLICATION supabase_realtime ADD TABLE public.behavior_records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.student_leaves;
ALTER PUBLICATION supabase_realtime ADD TABLE public.student_screenings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.home_visits;
ALTER PUBLICATION supabase_realtime ADD TABLE public.homeroom_records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.health_records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.early_childhood_dev;
ALTER PUBLICATION supabase_realtime ADD TABLE public.enrollments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.student_scores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_leaves;
ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_evaluations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.salary_records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.documents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.budget_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.assets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.procurement_records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.schedules;
ALTER PUBLICATION supabase_realtime ADD TABLE public.subjects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sdq_records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.student_subsidies;
ALTER PUBLICATION supabase_realtime ADD TABLE public.id_plan_records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.news_posts;
