
-- Remove duplicate auto_fill_school_id triggers (3 identical triggers per table → keep 1)
DROP TRIGGER IF EXISTS trg_autofill_school_id ON public.students;
DROP TRIGGER IF EXISTS trg_students_auto_school ON public.students;

DROP TRIGGER IF EXISTS trg_autofill_school_id ON public.personnel;
DROP TRIGGER IF EXISTS trg_personnel_auto_school ON public.personnel;

-- Same duplicate cleanup on profiles for consistency (keep trg_profiles_auto_school; drop others if present)
DROP TRIGGER IF EXISTS trg_auto_school_id ON public.profiles;
DROP TRIGGER IF EXISTS trg_autofill_school_id ON public.profiles;
