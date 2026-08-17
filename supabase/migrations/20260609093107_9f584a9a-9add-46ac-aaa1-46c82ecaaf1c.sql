DROP FUNCTION IF EXISTS public.get_public_org_chart() CASCADE;
CREATE OR REPLACE FUNCTION public.get_public_org_chart()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  prefix text,
  first_name text,
  last_name text,
  position_title text,
  position_level text,
  department text,
  subject_group text,
  academic_standing text,
  avatar_url text,
  sort_rank int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.user_id,
    p.prefix,
    p.first_name,
    p.last_name,
    p.position AS position_title,
    p.position_level,
    p.department,
    p.subject_group,
    p.academic_standing,
    pr.avatar_url,
    (CASE
      WHEN p.position ILIKE '%ผู้อำนวยการ%' AND p.position NOT ILIKE '%รอง%' THEN 1
      WHEN p.position ILIKE '%รองผู้อำนวยการ%' OR p.position ILIKE '%รอง ผอ%' THEN 2
      WHEN p.position ILIKE '%หัวหน้า%' THEN 3
      WHEN p.position_level ILIKE '%เชี่ยวชาญ%' THEN 4
      WHEN p.position_level ILIKE '%ชำนาญการพิเศษ%' THEN 5
      WHEN p.position_level ILIKE '%ชำนาญการ%' THEN 6
      WHEN p.position ILIKE '%ครู%' THEN 7
      ELSE 8
    END)::int AS sort_rank
  FROM public.personnel p
  LEFT JOIN public.profiles pr ON pr.id = p.user_id
  WHERE COALESCE(p.status, 'active') = 'active'
  ORDER BY sort_rank, p.first_name;
$$;
DO $guard$
BEGIN
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_public_org_chart() TO anon, authenticated';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
INSERT INTO public.cms_menu_items (label, url, sort_order, is_visible)
SELECT 'ผังบุคลากร', '/org-chart', 90, true
WHERE NOT EXISTS (SELECT 1 FROM public.cms_menu_items WHERE url = '/org-chart');
