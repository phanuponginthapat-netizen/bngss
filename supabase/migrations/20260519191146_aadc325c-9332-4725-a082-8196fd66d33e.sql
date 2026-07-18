
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_classroom_fk;
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_student_fk;
ALTER TABLE public.enrollments DROP CONSTRAINT IF EXISTS enroll_classroom_fk;
ALTER TABLE public.homeroom_records DROP CONSTRAINT IF EXISTS homeroom_classroom_fk;
ALTER TABLE public.homework_assignments DROP CONSTRAINT IF EXISTS hw_classroom_fk;
ALTER TABLE public.schedules DROP CONSTRAINT IF EXISTS sched_classroom_fk;
