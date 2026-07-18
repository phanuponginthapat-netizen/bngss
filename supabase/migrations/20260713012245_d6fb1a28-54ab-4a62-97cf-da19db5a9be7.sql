
CREATE INDEX IF NOT EXISTS idx_students_auth_user_id ON public.students(auth_user_id) WHERE auth_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_coop_members_user_id ON public.coop_members(user_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON public.error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_pdpa_requests_user_id ON public.pdpa_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_personnel_assessments_user_id ON public.personnel_assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_tutoring_bookings_user_id ON public.tutoring_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_wall_post_comments_user_id ON public.wall_post_comments(user_id);
ANALYZE public.students;
