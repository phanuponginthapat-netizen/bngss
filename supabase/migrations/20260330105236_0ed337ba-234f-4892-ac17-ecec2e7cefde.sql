-- Add all missing foreign key constraints

-- attendance -> students, subjects
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'attendance_student_id_fkey') THEN
    ALTER TABLE public.attendance ADD CONSTRAINT attendance_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'attendance_subject_id_fkey') THEN
    ALTER TABLE public.attendance ADD CONSTRAINT attendance_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE SET NULL;
  END IF;
END $$;
-- behavior_records -> students
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'behavior_records_student_id_fkey') THEN
    ALTER TABLE public.behavior_records ADD CONSTRAINT behavior_records_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
  END IF;
END $$;
-- students -> classrooms
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'students_classroom_id_fkey') THEN
    ALTER TABLE public.students ADD CONSTRAINT students_classroom_id_fkey FOREIGN KEY (classroom_id) REFERENCES public.classrooms(id) ON DELETE SET NULL;
  END IF;
END $$;
-- enrollments -> students, subjects, classrooms
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'enrollments_student_id_fkey') THEN
    ALTER TABLE public.enrollments ADD CONSTRAINT enrollments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'enrollments_subject_id_fkey') THEN
    ALTER TABLE public.enrollments ADD CONSTRAINT enrollments_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'enrollments_classroom_id_fkey') THEN
    ALTER TABLE public.enrollments ADD CONSTRAINT enrollments_classroom_id_fkey FOREIGN KEY (classroom_id) REFERENCES public.classrooms(id) ON DELETE SET NULL;
  END IF;
END $$;
-- student_scores -> subjects
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'student_scores_subject_id_fkey') THEN
    ALTER TABLE public.student_scores ADD CONSTRAINT student_scores_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;
  END IF;
END $$;
-- schedules -> classrooms, subjects
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'schedules_classroom_id_fkey') THEN
    ALTER TABLE public.schedules ADD CONSTRAINT schedules_classroom_id_fkey FOREIGN KEY (classroom_id) REFERENCES public.classrooms(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'schedules_subject_id_fkey') THEN
    ALTER TABLE public.schedules ADD CONSTRAINT schedules_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;
  END IF;
END $$;
-- teacher_assignments -> personnel, subjects, classrooms
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'teacher_assignments_personnel_id_fkey') THEN
    ALTER TABLE public.teacher_assignments ADD CONSTRAINT teacher_assignments_personnel_id_fkey FOREIGN KEY (personnel_id) REFERENCES public.personnel(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'teacher_assignments_subject_id_fkey') THEN
    ALTER TABLE public.teacher_assignments ADD CONSTRAINT teacher_assignments_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'teacher_assignments_classroom_id_fkey') THEN
    ALTER TABLE public.teacher_assignments ADD CONSTRAINT teacher_assignments_classroom_id_fkey FOREIGN KEY (classroom_id) REFERENCES public.classrooms(id) ON DELETE SET NULL;
  END IF;
END $$;
-- subject_indicators -> subjects, personnel
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'subject_indicators_subject_id_fkey') THEN
    ALTER TABLE public.subject_indicators ADD CONSTRAINT subject_indicators_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'subject_indicators_personnel_id_fkey') THEN
    ALTER TABLE public.subject_indicators ADD CONSTRAINT subject_indicators_personnel_id_fkey FOREIGN KEY (personnel_id) REFERENCES public.personnel(id) ON DELETE SET NULL;
  END IF;
END $$;
-- subject_score_columns -> subjects, personnel
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'subject_score_columns_subject_id_fkey') THEN
    ALTER TABLE public.subject_score_columns ADD CONSTRAINT subject_score_columns_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'subject_score_columns_personnel_id_fkey') THEN
    ALTER TABLE public.subject_score_columns ADD CONSTRAINT subject_score_columns_personnel_id_fkey FOREIGN KEY (personnel_id) REFERENCES public.personnel(id) ON DELETE SET NULL;
  END IF;
END $$;
-- student_column_scores -> subject_score_columns, students
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'student_column_scores_column_id_fkey') THEN
    ALTER TABLE public.student_column_scores ADD CONSTRAINT student_column_scores_column_id_fkey FOREIGN KEY (column_id) REFERENCES public.subject_score_columns(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'student_column_scores_student_id_fkey') THEN
    ALTER TABLE public.student_column_scores ADD CONSTRAINT student_column_scores_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
  END IF;
END $$;
-- student_assessment_scores -> assessment_criteria, students
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'student_assessment_scores_criteria_id_fkey') THEN
    ALTER TABLE public.student_assessment_scores ADD CONSTRAINT student_assessment_scores_criteria_id_fkey FOREIGN KEY (criteria_id) REFERENCES public.assessment_criteria(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'student_assessment_scores_student_id_fkey') THEN
    ALTER TABLE public.student_assessment_scores ADD CONSTRAINT student_assessment_scores_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
  END IF;
END $$;
-- homeroom_records -> students, classrooms
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'homeroom_records_student_id_fkey') THEN
    ALTER TABLE public.homeroom_records ADD CONSTRAINT homeroom_records_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'homeroom_records_classroom_id_fkey') THEN
    ALTER TABLE public.homeroom_records ADD CONSTRAINT homeroom_records_classroom_id_fkey FOREIGN KEY (classroom_id) REFERENCES public.classrooms(id) ON DELETE SET NULL;
  END IF;
END $$;
-- health_records, home_visits, student_screenings, sdq_records, student_leaves, vaccine_records, early_childhood_dev -> students
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'health_records_student_id_fkey') THEN
    ALTER TABLE public.health_records ADD CONSTRAINT health_records_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'home_visits_student_id_fkey') THEN
    ALTER TABLE public.home_visits ADD CONSTRAINT home_visits_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'student_screenings_student_id_fkey') THEN
    ALTER TABLE public.student_screenings ADD CONSTRAINT student_screenings_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'sdq_records_student_id_fkey') THEN
    ALTER TABLE public.sdq_records ADD CONSTRAINT sdq_records_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'student_leaves_student_id_fkey') THEN
    ALTER TABLE public.student_leaves ADD CONSTRAINT student_leaves_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'vaccine_records_student_id_fkey') THEN
    ALTER TABLE public.vaccine_records ADD CONSTRAINT vaccine_records_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'early_childhood_dev_student_id_fkey') THEN
    ALTER TABLE public.early_childhood_dev ADD CONSTRAINT early_childhood_dev_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
  END IF;
END $$;
-- staff_evaluations, staff_leaves, time_clock -> personnel
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'staff_evaluations_personnel_id_fkey') THEN
    ALTER TABLE public.staff_evaluations ADD CONSTRAINT staff_evaluations_personnel_id_fkey FOREIGN KEY (personnel_id) REFERENCES public.personnel(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'staff_leaves_personnel_id_fkey') THEN
    ALTER TABLE public.staff_leaves ADD CONSTRAINT staff_leaves_personnel_id_fkey FOREIGN KEY (personnel_id) REFERENCES public.personnel(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'time_clock_personnel_id_fkey') THEN
    ALTER TABLE public.time_clock ADD CONSTRAINT time_clock_personnel_id_fkey FOREIGN KEY (personnel_id) REFERENCES public.personnel(id) ON DELETE CASCADE;
  END IF;
END $$;
-- substitute_teaching, homework_assignments -> classrooms, subjects
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'substitute_teaching_classroom_id_fkey') THEN
    ALTER TABLE public.substitute_teaching ADD CONSTRAINT substitute_teaching_classroom_id_fkey FOREIGN KEY (classroom_id) REFERENCES public.classrooms(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'substitute_teaching_subject_id_fkey') THEN
    ALTER TABLE public.substitute_teaching ADD CONSTRAINT substitute_teaching_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'homework_assignments_classroom_id_fkey') THEN
    ALTER TABLE public.homework_assignments ADD CONSTRAINT homework_assignments_classroom_id_fkey FOREIGN KEY (classroom_id) REFERENCES public.classrooms(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'homework_assignments_subject_id_fkey') THEN
    ALTER TABLE public.homework_assignments ADD CONSTRAINT homework_assignments_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE SET NULL;
  END IF;
END $$;
-- cms_menu_items -> cms_pages
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'cms_menu_items_page_id_fkey') THEN
    ALTER TABLE public.cms_menu_items ADD CONSTRAINT cms_menu_items_page_id_fkey FOREIGN KEY (page_id) REFERENCES public.cms_pages(id) ON DELETE SET NULL;
  END IF;
END $$;
-- user_roles -> auth.users
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'user_roles_user_id_fkey') THEN
    ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;
-- profiles -> auth.users
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'profiles_id_fkey') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;
