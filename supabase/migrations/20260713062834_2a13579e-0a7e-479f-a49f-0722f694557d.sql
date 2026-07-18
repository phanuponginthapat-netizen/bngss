
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON public.enrollments(status);
CREATE INDEX IF NOT EXISTS idx_enrollments_student_status ON public.enrollments(student_id, status);
CREATE INDEX IF NOT EXISTS idx_enrollments_classroom_status ON public.enrollments(classroom_id, status);

CREATE INDEX IF NOT EXISTS idx_students_status ON public.students(status);
CREATE INDEX IF NOT EXISTS idx_students_status_classroom ON public.students(status, classroom_id);

CREATE INDEX IF NOT EXISTS idx_attendance_date_desc ON public.attendance(attendance_date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_student_date_desc ON public.attendance(student_id, attendance_date DESC);

CREATE INDEX IF NOT EXISTS idx_face_scan_logs_scan_date ON public.face_scan_logs(scan_date DESC);
CREATE INDEX IF NOT EXISTS idx_face_scan_logs_student_date ON public.face_scan_logs(student_id, scan_date DESC);

ANALYZE public.enrollments;
ANALYZE public.students;
ANALYZE public.attendance;
ANALYZE public.face_scan_logs;
