-- Score entry hardening (idempotent)
-- 1) Teachers may only write scores for subjects assigned to them (teacher_assignments);
--    admin/director and academic-department members keep full write access.
-- 2) Scores must be within 0..max_score (column scores) / 0..100 (summary scores).
-- 3) Scores cannot be changed after the classroom's grades are locked (admin/director only).
-- 4) Only admin/director can create, change or remove grade locks.

CREATE OR REPLACE FUNCTION public.can_write_subject_scores(_uid uuid, _subject_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_uid,'admin') OR public.has_role(_uid,'director')
      OR public.has_dept_position(_uid,'academic'::school_department,'member'::dept_position)
      OR EXISTS (SELECT 1 FROM public.teacher_assignments ta
                 JOIN public.personnel p ON p.id = ta.personnel_id
                 WHERE ta.subject_id = _subject_id AND p.user_id = _uid);
$$;

CREATE OR REPLACE FUNCTION public.is_grade_locked(_student_id uuid, _academic_year int, _semester int)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.grade_lock gl
    JOIN public.students s ON s.classroom_id = gl.classroom_id
    WHERE s.id = _student_id AND gl.status = 'locked'
      AND (CASE WHEN gl.academic_year > 2400 THEN gl.academic_year - 543 ELSE gl.academic_year END)
          = (CASE WHEN _academic_year > 2400 THEN _academic_year - 543 ELSE _academic_year END)
      AND (_semester IS NULL OR gl.semester IS NULL OR gl.semester = _semester)
  );
$$;

-- ---------- student_column_scores ----------
CREATE OR REPLACE FUNCTION public.guard_column_score()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.student_column_scores; _max numeric; _year int; _sem int; _uid uuid := auth.uid();
BEGIN
  r := COALESCE(NEW, OLD);
  SELECT c.max_score, s.academic_year, s.semester INTO _max, _year, _sem
  FROM public.subject_score_columns c JOIN public.subjects s ON s.id = c.subject_id
  WHERE c.id = r.column_id;
  IF TG_OP <> 'DELETE' AND NEW.score IS NOT NULL THEN
    IF NEW.score < 0 THEN RAISE EXCEPTION 'คะแนนติดลบไม่ได้' USING ERRCODE = '22003'; END IF;
    IF _max IS NOT NULL AND NEW.score > _max THEN
      RAISE EXCEPTION 'คะแนน % เกินคะแนนเต็ม %', NEW.score, _max USING ERRCODE = '22003';
    END IF;
  END IF;
  IF _uid IS NOT NULL AND NOT (public.has_role(_uid,'admin') OR public.has_role(_uid,'director'))
     AND public.is_grade_locked(r.student_id, _year, _sem) THEN
    RAISE EXCEPTION 'ห้องนี้ล็อกผลการเรียนแล้ว แก้คะแนนไม่ได้ — ติดต่อฝ่ายวิชาการ' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
DROP TRIGGER IF EXISTS trg_guard_column_score ON public.student_column_scores;
CREATE TRIGGER trg_guard_column_score BEFORE INSERT OR UPDATE OR DELETE ON public.student_column_scores
  FOR EACH ROW EXECUTE FUNCTION public.guard_column_score();

DROP POLICY IF EXISTS "Staff full access" ON public.student_column_scores;
DROP POLICY IF EXISTS teacher_or_admin_manage_scs ON public.student_column_scores;
DROP POLICY IF EXISTS staff_read_scs ON public.student_column_scores;
DROP POLICY IF EXISTS assigned_write_scs ON public.student_column_scores;
CREATE POLICY staff_read_scs ON public.student_column_scores FOR SELECT TO authenticated
  USING (public.is_staff_any((SELECT auth.uid())));
CREATE POLICY assigned_write_scs ON public.student_column_scores FOR ALL TO authenticated
  USING (public.can_write_subject_scores((SELECT auth.uid()),
         (SELECT c.subject_id FROM public.subject_score_columns c WHERE c.id = column_id)))
  WITH CHECK (public.can_write_subject_scores((SELECT auth.uid()),
         (SELECT c.subject_id FROM public.subject_score_columns c WHERE c.id = column_id)));

-- ---------- subject_score_columns ----------
CREATE OR REPLACE FUNCTION public.guard_score_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.max_score IS NOT NULL AND (NEW.max_score <= 0 OR NEW.max_score > 1000) THEN
    RAISE EXCEPTION 'คะแนนเต็มต้องอยู่ระหว่าง 1–1000' USING ERRCODE = '22003';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_score_column ON public.subject_score_columns;
CREATE TRIGGER trg_guard_score_column BEFORE INSERT OR UPDATE ON public.subject_score_columns
  FOR EACH ROW EXECUTE FUNCTION public.guard_score_column();

DROP POLICY IF EXISTS "Staff full access" ON public.subject_score_columns;
DROP POLICY IF EXISTS teacher_or_admin_manage_ssc ON public.subject_score_columns;
DROP POLICY IF EXISTS assigned_write_ssc ON public.subject_score_columns;
CREATE POLICY assigned_write_ssc ON public.subject_score_columns FOR ALL TO authenticated
  USING (public.can_write_subject_scores((SELECT auth.uid()), subject_id))
  WITH CHECK (public.can_write_subject_scores((SELECT auth.uid()), subject_id));

-- ---------- student_scores ----------
CREATE OR REPLACE FUNCTION public.guard_student_score()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.student_scores; _uid uuid := auth.uid();
BEGIN
  r := COALESCE(NEW, OLD);
  IF TG_OP <> 'DELETE' THEN
    IF LEAST(COALESCE(NEW.midterm_score,0),COALESCE(NEW.final_score,0),
             COALESCE(NEW.assignment_score,0),COALESCE(NEW.attendance_score,0)) < 0 THEN
      RAISE EXCEPTION 'คะแนนติดลบไม่ได้' USING ERRCODE = '22003';
    END IF;
    IF COALESCE(NEW.midterm_score,0)+COALESCE(NEW.final_score,0)+COALESCE(NEW.assignment_score,0)+COALESCE(NEW.attendance_score,0) > 100 THEN
      RAISE EXCEPTION 'คะแนนรวมเกิน 100' USING ERRCODE = '22003';
    END IF;
  END IF;
  IF _uid IS NOT NULL AND NOT (public.has_role(_uid,'admin') OR public.has_role(_uid,'director'))
     AND r.student_id IS NOT NULL AND public.is_grade_locked(r.student_id, r.academic_year, r.semester) THEN
    RAISE EXCEPTION 'ห้องนี้ล็อกผลการเรียนแล้ว แก้คะแนนไม่ได้ — ติดต่อฝ่ายวิชาการ' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
DROP TRIGGER IF EXISTS trg_guard_student_score ON public.student_scores;
CREATE TRIGGER trg_guard_student_score BEFORE INSERT OR UPDATE OR DELETE ON public.student_scores
  FOR EACH ROW EXECUTE FUNCTION public.guard_student_score();

DROP POLICY IF EXISTS "Staff full access" ON public.student_scores;
DROP POLICY IF EXISTS tenant_isolation_student_scores ON public.student_scores;
DROP POLICY IF EXISTS staff_read_ss ON public.student_scores;
DROP POLICY IF EXISTS assigned_write_ss ON public.student_scores;
CREATE POLICY staff_read_ss ON public.student_scores FOR SELECT TO authenticated
  USING (public.is_staff_any((SELECT auth.uid())));
CREATE POLICY assigned_write_ss ON public.student_scores FOR ALL TO authenticated
  USING (public.can_write_subject_scores((SELECT auth.uid()), subject_id))
  WITH CHECK (public.can_write_subject_scores((SELECT auth.uid()), subject_id));

-- ---------- grade_lock: admin/director only ----------
DROP POLICY IF EXISTS "Teachers can manage grade_lock" ON public.grade_lock;
DROP POLICY IF EXISTS admin_manage_grade_lock ON public.grade_lock;
CREATE POLICY admin_manage_grade_lock ON public.grade_lock FOR ALL TO authenticated
  USING (public.has_role((SELECT auth.uid()),'admin') OR public.has_role((SELECT auth.uid()),'director'))
  WITH CHECK (public.has_role((SELECT auth.uid()),'admin') OR public.has_role((SELECT auth.uid()),'director'));
