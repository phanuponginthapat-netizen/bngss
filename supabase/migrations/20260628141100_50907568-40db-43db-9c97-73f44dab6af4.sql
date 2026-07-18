-- ตั้ง is_current ตามวันที่ปัจจุบัน (auto switch semester)
CREATE OR REPLACE FUNCTION public.auto_set_current_period()
RETURNS TABLE(academic_year_be int, semester smallint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today date := CURRENT_DATE;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director')) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  UPDATE public.academic_periods SET is_current = false WHERE is_current = true;

  UPDATE public.academic_periods
     SET is_current = true
   WHERE today BETWEEN start_date AND end_date
     AND is_closed = false;

  RETURN QUERY
    SELECT ap.academic_year_be, ap.semester
    FROM public.academic_periods ap
    WHERE ap.is_current = true;
END;
$$;

REVOKE ALL ON FUNCTION public.auto_set_current_period() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auto_set_current_period() TO authenticated;

-- สร้างปีการศึกษาถัดไป (เทอม 1 + 2) และปิดปีก่อนหน้า
CREATE OR REPLACE FUNCTION public.create_next_year_periods(closing_year_be int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_be int := closing_year_be + 1;
  next_ce int := next_be - 543;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director')) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- ปิดปีเก่า
  UPDATE public.academic_periods
     SET is_closed = true, is_current = false, updated_at = now()
   WHERE academic_year_be = closing_year_be;

  -- เทอม 1 ปีใหม่ (พ.ค.–ต.ค.)
  INSERT INTO public.academic_periods (academic_year_be, semester, start_date, end_date, is_current, is_closed)
  VALUES (next_be, 1, make_date(next_ce, 5, 16), make_date(next_ce, 10, 10), true, false)
  ON CONFLICT (academic_year_be, semester) DO NOTHING;

  -- เทอม 2 ปีใหม่ (พ.ย.–มี.ค.)
  INSERT INTO public.academic_periods (academic_year_be, semester, start_date, end_date, is_current, is_closed)
  VALUES (next_be, 2, make_date(next_ce, 11, 1), make_date(next_ce + 1, 3, 31), false, false)
  ON CONFLICT (academic_year_be, semester) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.create_next_year_periods(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_next_year_periods(int) TO authenticated;