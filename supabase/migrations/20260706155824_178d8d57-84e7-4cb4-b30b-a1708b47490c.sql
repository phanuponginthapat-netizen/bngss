
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance(attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_date_student ON public.attendance(attendance_date, student_id);
CREATE INDEX IF NOT EXISTS idx_face_scan_logs_date ON public.face_scan_logs(scan_date);
CREATE INDEX IF NOT EXISTS idx_face_scan_logs_date_student ON public.face_scan_logs(scan_date, student_id);
CREATE INDEX IF NOT EXISTS idx_students_status ON public.students(status);
CREATE INDEX IF NOT EXISTS idx_students_status_classroom ON public.students(status, classroom_id);
CREATE INDEX IF NOT EXISTS idx_cms_settings_key ON public.cms_settings(key);
ANALYZE public.attendance;
ANALYZE public.face_scan_logs;
ANALYZE public.students;
ANALYZE public.cms_settings;
