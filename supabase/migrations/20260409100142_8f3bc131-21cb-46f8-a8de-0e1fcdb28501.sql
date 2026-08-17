-- Performance indexes for frequently queried tables

-- attendance
CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON public.attendance (student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance (attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_year_semester ON public.attendance (academic_year, semester);

-- behavior_records  
CREATE INDEX IF NOT EXISTS idx_behavior_student_id ON public.behavior_records (student_id);
CREATE INDEX IF NOT EXISTS idx_behavior_date ON public.behavior_records (record_date);

-- student_leaves
CREATE INDEX IF NOT EXISTS idx_student_leaves_student_id ON public.student_leaves (student_id);
CREATE INDEX IF NOT EXISTS idx_student_leaves_status ON public.student_leaves (status);

-- home_visits
CREATE INDEX IF NOT EXISTS idx_home_visits_student_id ON public.home_visits (student_id);
CREATE INDEX IF NOT EXISTS idx_home_visits_classroom_id ON public.home_visits (classroom_id);

-- homeroom_records
CREATE INDEX IF NOT EXISTS idx_homeroom_records_classroom_id ON public.homeroom_records (classroom_id);
CREATE INDEX IF NOT EXISTS idx_homeroom_records_year ON public.homeroom_records (academic_year);

-- enrollments
CREATE INDEX IF NOT EXISTS idx_enrollments_student_subject ON public.enrollments (student_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_classroom ON public.enrollments (classroom_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_year ON public.enrollments (academic_year);

-- student_scores (uses student_code, not student_id)
CREATE INDEX IF NOT EXISTS idx_student_scores_subject_id ON public.student_scores (subject_id);
CREATE INDEX IF NOT EXISTS idx_student_scores_student_code ON public.student_scores (student_code);

-- schedules
CREATE INDEX IF NOT EXISTS idx_schedules_classroom_id ON public.schedules (classroom_id);

-- staff_leaves
CREATE INDEX IF NOT EXISTS idx_staff_leaves_personnel_id ON public.staff_leaves (personnel_id);
CREATE INDEX IF NOT EXISTS idx_staff_leaves_status ON public.staff_leaves (status);

-- notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications (user_id, is_read);

-- students
CREATE INDEX IF NOT EXISTS idx_students_classroom_id ON public.students (classroom_id);
CREATE INDEX IF NOT EXISTS idx_students_status ON public.students (status);
CREATE INDEX IF NOT EXISTS idx_students_student_code ON public.students (student_code);

-- personnel
CREATE INDEX IF NOT EXISTS idx_personnel_user_id ON public.personnel (user_id);
CREATE INDEX IF NOT EXISTS idx_personnel_employee_code ON public.personnel (employee_code);

-- parent_student_links
CREATE INDEX IF NOT EXISTS idx_parent_links_parent ON public.parent_student_links (parent_user_id);
CREATE INDEX IF NOT EXISTS idx_parent_links_student ON public.parent_student_links (student_id);

-- sdq_records
CREATE INDEX IF NOT EXISTS idx_sdq_student_id ON public.sdq_records (student_id);

-- Enable realtime for key tables
DO $$
BEGIN
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'students'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.students;
    END IF;
  END $$;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'classrooms'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.classrooms;
    END IF;
  END $$;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'behavior_records'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.behavior_records;
    END IF;
  END $$;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'student_leaves'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.student_leaves;
    END IF;
  END $$;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'home_visits'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.home_visits;
    END IF;
  END $$;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'homeroom_records'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.homeroom_records;
    END IF;
  END $$;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'staff_leaves'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_leaves;
    END IF;
  END $$;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'documents'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.documents;
    END IF;
  END $$;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'budget_transactions'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.budget_transactions;
    END IF;
  END $$;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'assets'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.assets;
    END IF;
  END $$;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'student_scores'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.student_scores;
    END IF;
  END $$;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'enrollments'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.enrollments;
    END IF;
  END $$;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'schedules'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.schedules;
    END IF;
  END $$;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'health_records'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.health_records;
    END IF;
  END $$;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'sdq_records'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.sdq_records;
    END IF;
  END $$;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'parent_student_links'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.parent_student_links;
    END IF;
  END $$;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;