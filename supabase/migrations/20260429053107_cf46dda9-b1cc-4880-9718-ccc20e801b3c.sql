
-- ============= Performance Indexes (verified against actual schema) =============

-- Students
CREATE INDEX IF NOT EXISTS idx_students_classroom_status ON public.students(classroom_id, status);
CREATE INDEX IF NOT EXISTS idx_students_student_code ON public.students(student_code);

-- Attendance
CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON public.attendance(student_id, attendance_date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_year_sem ON public.attendance(academic_year, semester);
CREATE INDEX IF NOT EXISTS idx_attendance_subject ON public.attendance(subject_id);

-- Enrollments
CREATE INDEX IF NOT EXISTS idx_enrollments_student_year ON public.enrollments(student_id, academic_year, semester);
CREATE INDEX IF NOT EXISTS idx_enrollments_class_subject ON public.enrollments(classroom_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_subject ON public.enrollments(subject_id);

-- Scores (uses student_code, not student_id)
CREATE INDEX IF NOT EXISTS idx_student_scores_code_subject ON public.student_scores(student_code, subject_id);
CREATE INDEX IF NOT EXISTS idx_student_scores_year ON public.student_scores(academic_year, semester);
CREATE INDEX IF NOT EXISTS idx_student_column_scores_student ON public.student_column_scores(student_id);
CREATE INDEX IF NOT EXISTS idx_subject_score_columns_subject ON public.subject_score_columns(subject_id);

-- Behavior
CREATE INDEX IF NOT EXISTS idx_behavior_student_date ON public.behavior_records(student_id, record_date DESC);
CREATE INDEX IF NOT EXISTS idx_behavior_type_date ON public.behavior_records(behavior_type, record_date DESC);

-- Leaves
CREATE INDEX IF NOT EXISTS idx_student_leaves_student ON public.student_leaves(student_id, start_date DESC);
CREATE INDEX IF NOT EXISTS idx_student_leaves_status ON public.student_leaves(status);
CREATE INDEX IF NOT EXISTS idx_staff_leaves_personnel ON public.staff_leaves(personnel_id, start_date DESC);
CREATE INDEX IF NOT EXISTS idx_staff_leaves_status ON public.staff_leaves(status);

-- Notifications & Inbox (queried per-user constantly)
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbox_user_unread ON public.inbox_items(user_id, is_read, created_at DESC);

-- Documents & E-Form
CREATE INDEX IF NOT EXISTS idx_documents_created_by ON public.documents(created_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_doc_date ON public.documents(doc_date DESC);
CREATE INDEX IF NOT EXISTS idx_document_recipients_user ON public.document_recipients(recipient_user_id) WHERE recipient_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_eforms_sender ON public.eforms(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_eforms_status ON public.eforms(status);
CREATE INDEX IF NOT EXISTS idx_eform_recipients_eform ON public.eform_recipients(eform_id);
CREATE INDEX IF NOT EXISTS idx_eform_recipients_user ON public.eform_recipients(recipient_id, signed_at);

-- Schedules
CREATE INDEX IF NOT EXISTS idx_schedules_class_day ON public.schedules(classroom_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_schedules_subject ON public.schedules(subject_id);

-- Personnel & HR
CREATE INDEX IF NOT EXISTS idx_personnel_user ON public.personnel(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_personnel_status ON public.personnel(status);
CREATE INDEX IF NOT EXISTS idx_personnel_employee_code ON public.personnel(employee_code);

-- News / Calendar / Homeroom
CREATE INDEX IF NOT EXISTS idx_news_published ON public.news_posts(is_published, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_academic_events_date ON public.academic_events(event_date);
CREATE INDEX IF NOT EXISTS idx_homeroom_class_date ON public.homeroom_records(classroom_id, homeroom_date DESC);
CREATE INDEX IF NOT EXISTS idx_homeroom_year ON public.homeroom_records(academic_year, semester);

-- User Roles (queried on every page load)
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);

-- Parent links
CREATE INDEX IF NOT EXISTS idx_parent_links_parent ON public.parent_student_links(parent_user_id);
CREATE INDEX IF NOT EXISTS idx_parent_links_student ON public.parent_student_links(student_id);

-- PA / Evaluations
CREATE INDEX IF NOT EXISTS idx_pa_agreements_personnel_year ON public.pa_agreements(personnel_id, academic_year);
CREATE INDEX IF NOT EXISTS idx_pa_indicator_scores_agreement ON public.pa_indicator_scores(pa_agreement_id);

-- Health & Home Visit
CREATE INDEX IF NOT EXISTS idx_health_records_student ON public.health_records(student_id, visit_date DESC);
CREATE INDEX IF NOT EXISTS idx_home_visits_student ON public.home_visits(student_id, visit_date DESC);

-- Subjects
CREATE INDEX IF NOT EXISTS idx_subjects_year_sem ON public.subjects(academic_year, semester);

-- Update planner statistics
ANALYZE public.attendance;
ANALYZE public.enrollments;
ANALYZE public.notifications;
ANALYZE public.inbox_items;
ANALYZE public.behavior_records;
ANALYZE public.student_scores;
ANALYZE public.documents;
ANALYZE public.eforms;
ANALYZE public.user_roles;
ANALYZE public.personnel;
ANALYZE public.students;
