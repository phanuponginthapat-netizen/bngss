UPDATE public.schedules SET academic_year = academic_year - 543 WHERE academic_year > 2400;
UPDATE public.teacher_assignments SET academic_year = academic_year - 543 WHERE academic_year > 2400;