-- Normalize lesson_plans / teaching_logbook academic_year from BE (พ.ศ.) to CE (ค.ศ.)
-- The app now writes CE and shows BE on screen. Run once on the school backend.
UPDATE public.lesson_plans SET academic_year = academic_year - 543 WHERE academic_year > 2400;
UPDATE public.teaching_logbook SET academic_year = academic_year - 543 WHERE academic_year > 2400;
