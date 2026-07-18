ALTER TABLE public.classrooms ADD COLUMN IF NOT EXISTS homeroom_teachers text[] DEFAULT '{}'::text[];

UPDATE public.classrooms
SET homeroom_teachers = ARRAY(
  SELECT t FROM unnest(ARRAY[homeroom_teacher, homeroom_teacher_2]) AS t
  WHERE t IS NOT NULL AND length(trim(t)) > 0
)
WHERE (homeroom_teachers IS NULL OR array_length(homeroom_teachers, 1) IS NULL)
  AND (homeroom_teacher IS NOT NULL OR homeroom_teacher_2 IS NOT NULL);