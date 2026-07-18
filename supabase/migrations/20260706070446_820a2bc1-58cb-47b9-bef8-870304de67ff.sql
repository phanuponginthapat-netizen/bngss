-- === FK 1: students.auth_user_id → auth.users (SET NULL on delete) ===
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'students_auth_user_id_fkey'
  ) THEN
    ALTER TABLE public.students
      ADD CONSTRAINT students_auth_user_id_fkey
      FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- === FK 2 & 3: homework_submissions.student_id / school_id ===
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'homework_submissions_student_id_fkey') THEN
    ALTER TABLE public.homework_submissions
      ADD CONSTRAINT homework_submissions_student_id_fkey
      FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'homework_submissions_school_id_fkey') THEN
    ALTER TABLE public.homework_submissions
      ADD CONSTRAINT homework_submissions_school_id_fkey
      FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;
  END IF;
END $$;

-- === UNIQUE: LINE user id must be unique across profiles/students ===
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_line_user_id_uniq
  ON public.profiles(line_user_id) WHERE line_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_students_line_user_id_uniq
  ON public.students(line_user_id) WHERE line_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_students_line_user_id_2_uniq
  ON public.students(line_user_id_2) WHERE line_user_id_2 IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_students_line_user_id_3_uniq
  ON public.students(line_user_id_3) WHERE line_user_id_3 IS NOT NULL;

-- === UNIQUE: active enrollment per student+subject+academic_year ===
CREATE UNIQUE INDEX IF NOT EXISTS idx_enrollments_active_uniq
  ON public.enrollments(student_id, subject_id, academic_year)
  WHERE status = 'active';