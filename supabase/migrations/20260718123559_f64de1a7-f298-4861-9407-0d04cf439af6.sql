-- 1) Merge duplicate classrooms: move students to the oldest room per (grade_level, name, academic_year), then delete duplicates
WITH ranked AS (
  SELECT id, grade_level, name, academic_year,
         ROW_NUMBER() OVER (PARTITION BY grade_level, name, academic_year ORDER BY created_at ASC) AS rn,
         FIRST_VALUE(id) OVER (PARTITION BY grade_level, name, academic_year ORDER BY created_at ASC) AS keeper_id
  FROM public.classrooms
),
dups AS (SELECT id, keeper_id FROM ranked WHERE rn > 1)
UPDATE public.students s
SET classroom_id = d.keeper_id
FROM dups d
WHERE s.classroom_id = d.id;
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY grade_level, name, academic_year ORDER BY created_at ASC) AS rn
  FROM public.classrooms
)
DELETE FROM public.classrooms WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
-- 2) Add unique constraint to prevent future duplicates
DO $idxguard$
BEGIN
  EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS classrooms_unique_name_grade_year
  ON public.classrooms (grade_level, name, academic_year)';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
