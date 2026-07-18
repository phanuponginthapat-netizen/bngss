
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_subject_fk;
NOTIFY pgrst, 'reload schema';
