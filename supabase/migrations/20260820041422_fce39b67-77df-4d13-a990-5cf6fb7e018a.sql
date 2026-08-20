INSERT INTO public.academic_periods (academic_year_be, semester, start_date, end_date, is_current, is_closed)
SELECT 2569, 1, DATE '2026-05-16', DATE '2026-10-10', true, false
WHERE NOT EXISTS (SELECT 1 FROM public.academic_periods WHERE academic_year_be=2569 AND semester=1);
INSERT INTO public.academic_periods (academic_year_be, semester, start_date, end_date, is_current, is_closed)
SELECT 2569, 2, DATE '2026-11-01', DATE '2027-03-31', false, false
WHERE NOT EXISTS (SELECT 1 FROM public.academic_periods WHERE academic_year_be=2569 AND semester=2);