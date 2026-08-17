CREATE OR REPLACE FUNCTION public.normalize_thai_teacher_name(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT regexp_replace(
    replace(
      replace(
        replace(
          regexp_replace(
            coalesce(input, ''),
            '^(ครู|นาย|นางสาว|นาง|น\.ส\.|ดร\.|อ\.)\s*',
            ''
          ),
          '์',
          ''
        ),
        '',
        ''
      ),
      '-',
      ''
    ),
    '\s+',
    '',
    'g'
  )
$$;
CREATE OR REPLACE FUNCTION public.fill_schedule_teacher_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  found_id uuid;
  normalized_teacher text;
BEGIN
  IF NEW.teacher_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.teacher_name IS NULL OR length(trim(NEW.teacher_name)) = 0 THEN
    RETURN NEW;
  END IF;

  normalized_teacher := public.normalize_thai_teacher_name(NEW.teacher_name);

  SELECT id INTO found_id
  FROM public.personnel
  WHERE status = 'active'
    AND (
      public.normalize_thai_teacher_name(COALESCE(prefix,'') || first_name || ' ' || COALESCE(last_name,'')) = normalized_teacher
      OR public.normalize_thai_teacher_name(first_name) = split_part(normalized_teacher, ' ', 1)
      OR normalized_teacher LIKE public.normalize_thai_teacher_name(first_name) || '%'
      OR public.normalize_thai_teacher_name(first_name) LIKE normalized_teacher || '%'
    )
  ORDER BY
    CASE
      WHEN public.normalize_thai_teacher_name(COALESCE(prefix,'') || first_name || ' ' || COALESCE(last_name,'')) = normalized_teacher THEN 0
      WHEN public.normalize_thai_teacher_name(first_name) = normalized_teacher THEN 1
      ELSE 2
    END,
    CASE WHEN COALESCE(last_name, '') <> '-' THEN 0 ELSE 1 END,
    created_at NULLS LAST
  LIMIT 1;

  NEW.teacher_id := found_id;
  RETURN NEW;
END;
$$;
UPDATE public.schedules s
SET teacher_id = p.id
FROM public.personnel p
WHERE s.teacher_id IS NULL
  AND s.teacher_name IS NOT NULL
  AND p.status = 'active'
  AND (
    public.normalize_thai_teacher_name(COALESCE(p.prefix,'') || p.first_name || ' ' || COALESCE(p.last_name,'')) = public.normalize_thai_teacher_name(s.teacher_name)
    OR public.normalize_thai_teacher_name(s.teacher_name) LIKE public.normalize_thai_teacher_name(p.first_name) || '%'
    OR public.normalize_thai_teacher_name(p.first_name) LIKE public.normalize_thai_teacher_name(s.teacher_name) || '%'
  );
