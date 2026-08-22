create index if not exists idx_face_scan_logs_school_date on public.face_scan_logs(school_id, scan_date);
create index if not exists idx_sdq_school_year on public.sdq_records(school_id, academic_year);
create index if not exists idx_attendance_school_date on public.attendance(school_id, date);
