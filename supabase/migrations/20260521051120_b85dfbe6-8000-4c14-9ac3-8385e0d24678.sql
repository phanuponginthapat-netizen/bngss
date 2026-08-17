-- ============== schedules: unique slot ==============
DELETE FROM public.schedules s1
USING public.schedules s2
WHERE s1.id < s2.id
  AND s1.classroom_id = s2.classroom_id
  AND s1.day_of_week = s2.day_of_week
  AND s1.period = s2.period
  AND COALESCE(s1.academic_year,0) = COALESCE(s2.academic_year,0)
  AND COALESCE(s1.semester,0) = COALESCE(s2.semester,0);
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.schedules DROP CONSTRAINT IF EXISTS schedules_unique_slot';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.schedules
  ADD CONSTRAINT schedules_unique_slot
  UNIQUE (classroom_id, day_of_week, period, academic_year, semester)';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- ============== fill_schedule_teacher_id + subject_id ==============
CREATE OR REPLACE FUNCTION public.fill_schedule_teacher_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cls_grade text;
  found_subject_id uuid;
  found_teacher_id uuid;
  raw_name text;
  norm_name text;
BEGIN
  IF NEW.teacher_id IS NULL AND NEW.teacher_name IS NOT NULL AND NEW.teacher_name <> '' THEN
    norm_name := public.normalize_thai_teacher_name(NEW.teacher_name);
    SELECT id INTO found_teacher_id FROM public.personnel
    WHERE public.normalize_thai_teacher_name(CONCAT(prefix, first_name, ' ', last_name)) = norm_name
       OR public.normalize_thai_teacher_name(CONCAT(first_name, ' ', last_name)) = norm_name
       OR public.normalize_thai_teacher_name(first_name) = norm_name
    LIMIT 1;
    NEW.teacher_id := found_teacher_id;
  END IF;

  IF NEW.subject_id IS NULL AND NEW.classroom_id IS NOT NULL THEN
    raw_name := COALESCE(NEW.subject_name_raw, '');
    IF raw_name <> '' THEN
      SELECT grade_level INTO cls_grade FROM public.classrooms WHERE id = NEW.classroom_id;
      SELECT id INTO found_subject_id FROM public.subjects
      WHERE name_th = raw_name AND grade_level = cls_grade
        AND COALESCE(semester, NEW.semester) = COALESCE(NEW.semester, 1)
        AND COALESCE(academic_year, NEW.academic_year) = COALESCE(NEW.academic_year, EXTRACT(year FROM now())::int)
      LIMIT 1;
      IF found_subject_id IS NULL THEN
        SELECT id INTO found_subject_id FROM public.subjects
        WHERE name_th = raw_name AND grade_level = cls_grade
        LIMIT 1;
      END IF;
      IF found_subject_id IS NULL THEN
        BEGIN
          INSERT INTO public.subjects (code, name_th, grade_level, semester, academic_year, subject_type, school_id)
          VALUES (
            'AUTO-' || substr(md5(raw_name || cls_grade || COALESCE(NEW.semester::text,'1')),1,8),
            raw_name, cls_grade,
            COALESCE(NEW.semester, 1),
            COALESCE(NEW.academic_year, EXTRACT(year FROM now())::int),
            CASE WHEN raw_name ~* 'ลูกเสือ|เนตรนารี|ชุมนุม|ซ่อมเสริม|Maker|กิจกรรม' THEN 'activity' ELSE 'required' END,
            NEW.school_id
          )
          RETURNING id INTO found_subject_id;
        EXCEPTION WHEN unique_violation THEN
          SELECT id INTO found_subject_id FROM public.subjects
          WHERE name_th = raw_name AND grade_level = cls_grade
            AND COALESCE(semester, NEW.semester) = COALESCE(NEW.semester, 1)
          LIMIT 1;
        END;
      END IF;
      NEW.subject_id := found_subject_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DO $guard$
BEGIN
  EXECUTE 'REVOKE EXECUTE ON FUNCTION public.fill_schedule_teacher_id() FROM PUBLIC, anon, authenticated';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_fill_schedule_teacher_id ON public.schedules';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_fill_schedule_teacher_id
BEFORE INSERT OR UPDATE OF teacher_name, teacher_id, subject_name_raw, subject_id, classroom_id
ON public.schedules FOR EACH ROW EXECUTE FUNCTION public.fill_schedule_teacher_id()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- Backfill subject_id (re-run trigger by touching rows)
UPDATE public.schedules SET subject_name_raw = subject_name_raw WHERE subject_id IS NULL AND subject_name_raw IS NOT NULL;
-- ============== auto-sync teacher_assignments ==============
CREATE OR REPLACE FUNCTION public.sync_teacher_assignment_from_schedule()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.teacher_id IS NOT NULL AND NEW.subject_id IS NOT NULL AND NEW.classroom_id IS NOT NULL THEN
    INSERT INTO public.teacher_assignments (personnel_id, subject_id, classroom_id, academic_year, semester)
    VALUES (
      NEW.teacher_id, NEW.subject_id, NEW.classroom_id,
      COALESCE(NEW.academic_year, EXTRACT(year FROM now())::int),
      COALESCE(NEW.semester, 1)
    )
    ON CONFLICT (personnel_id, subject_id, classroom_id, academic_year, semester) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
DO $guard$
BEGIN
  EXECUTE 'REVOKE EXECUTE ON FUNCTION public.sync_teacher_assignment_from_schedule() FROM PUBLIC, anon, authenticated';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_sync_teacher_assignment ON public.schedules';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE TRIGGER trg_sync_teacher_assignment
AFTER INSERT OR UPDATE OF teacher_id, subject_id, classroom_id ON public.schedules
FOR EACH ROW EXECUTE FUNCTION public.sync_teacher_assignment_from_schedule()';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- ============== pp5_files / pp6_files ==============
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.pp5_files
  ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS personnel_id uuid REFERENCES public.personnel(id) ON DELETE SET NULL';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $idxguard$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_pp5_files_subject_id ON public.pp5_files(subject_id)';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
DO $idxguard$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_pp5_files_personnel_id ON public.pp5_files(personnel_id)';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.pp6_files
  ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS personnel_id uuid REFERENCES public.personnel(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS classroom_id uuid REFERENCES public.classrooms(id) ON DELETE SET NULL';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $idxguard$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_pp6_files_subject_id ON public.pp6_files(subject_id)';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
DO $idxguard$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_pp6_files_personnel_id ON public.pp6_files(personnel_id)';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
UPDATE public.pp5_files pf SET subject_id = s.id
FROM public.subjects s
WHERE pf.subject_id IS NULL
  AND s.name_th = pf.subject_name
  AND s.grade_level = pf.grade_level
  AND COALESCE(s.semester, pf.semester) = pf.semester;
UPDATE public.pp5_files pf SET personnel_id = p.id
FROM public.personnel p
WHERE pf.personnel_id IS NULL AND pf.teacher_name IS NOT NULL
  AND public.normalize_thai_teacher_name(CONCAT(p.prefix, p.first_name, ' ', p.last_name))
      = public.normalize_thai_teacher_name(pf.teacher_name);
UPDATE public.pp6_files pf SET personnel_id = p.id
FROM public.personnel p
WHERE pf.personnel_id IS NULL AND pf.teacher_name IS NOT NULL
  AND public.normalize_thai_teacher_name(CONCAT(p.prefix, p.first_name, ' ', p.last_name))
      = public.normalize_thai_teacher_name(pf.teacher_name);
-- ============== validate_schedules RPC ==============
CREATE OR REPLACE FUNCTION public.validate_schedules(_year integer DEFAULT NULL, _sem integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  result jsonb;
  yr int := COALESCE(_year, EXTRACT(year FROM now())::int);
  sm int := COALESCE(_sem, 1);
BEGIN
  SELECT jsonb_build_object(
    'year', yr, 'semester', sm,
    'missing_subject', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id, 'classroom', c.classroom_name, 'day', s.day_of_week,
        'period', s.period, 'subject_name_raw', s.subject_name_raw, 'teacher', s.teacher_name
      ))
      FROM public.schedules s LEFT JOIN public.classrooms c ON c.id = s.classroom_id
      WHERE s.subject_id IS NULL
        AND COALESCE(s.academic_year, yr) = yr AND COALESCE(s.semester, sm) = sm
    ), '[]'::jsonb),
    'missing_teacher', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id, 'classroom', c.classroom_name, 'day', s.day_of_week,
        'period', s.period, 'subject_name_raw', s.subject_name_raw, 'teacher_name', s.teacher_name
      ))
      FROM public.schedules s LEFT JOIN public.classrooms c ON c.id = s.classroom_id
      WHERE s.teacher_id IS NULL AND s.teacher_name IS NOT NULL AND s.teacher_name <> ''
        AND COALESCE(s.academic_year, yr) = yr AND COALESCE(s.semester, sm) = sm
    ), '[]'::jsonb),
    'teacher_conflicts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'teacher_id', teacher_id, 'teacher_name', tn,
        'day', day_of_week, 'period', period, 'classrooms', cls
      ))
      FROM (
        SELECT s.teacher_id, s.day_of_week, s.period,
               (SELECT CONCAT(prefix, first_name, ' ', last_name) FROM public.personnel WHERE id = s.teacher_id) AS tn,
               array_agg(DISTINCT c.classroom_name) AS cls,
               COUNT(DISTINCT s.classroom_id) AS cnt
        FROM public.schedules s LEFT JOIN public.classrooms c ON c.id = s.classroom_id
        WHERE s.teacher_id IS NOT NULL
          AND COALESCE(s.academic_year, yr) = yr AND COALESCE(s.semester, sm) = sm
        GROUP BY s.teacher_id, s.day_of_week, s.period
      ) t WHERE cnt > 1
    ), '[]'::jsonb),
    'classroom_conflicts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'classroom_id', classroom_id, 'classroom', cn,
        'day', day_of_week, 'period', period, 'subjects', subs
      ))
      FROM (
        SELECT s.classroom_id, s.day_of_week, s.period,
               (SELECT classroom_name FROM public.classrooms WHERE id = s.classroom_id) AS cn,
               array_agg(DISTINCT COALESCE(s.subject_name_raw, '?')) AS subs,
               COUNT(DISTINCT COALESCE(s.subject_id, gen_random_uuid())) AS cnt
        FROM public.schedules s
        WHERE COALESCE(s.academic_year, yr) = yr AND COALESCE(s.semester, sm) = sm
        GROUP BY s.classroom_id, s.day_of_week, s.period
      ) t WHERE cnt > 1
    ), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;
DO $guard$
BEGIN
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.validate_schedules(integer, integer) TO authenticated';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
