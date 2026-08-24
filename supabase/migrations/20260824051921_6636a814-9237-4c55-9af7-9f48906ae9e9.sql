DROP POLICY IF EXISTS school_scope_restrictive ON public.student_leaves;
CREATE POLICY school_scope_restrictive ON public.student_leaves
AS RESTRICTIVE FOR ALL TO authenticated
USING (
  student_id IS NULL OR EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = student_leaves.student_id
      AND (s.school_id IS NULL OR s.school_id = public.get_user_school_id(auth.uid()))
  )
)
WITH CHECK (
  student_id IS NULL OR EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = student_leaves.student_id
      AND (s.school_id IS NULL OR s.school_id = public.get_user_school_id(auth.uid()))
  )
);

DROP POLICY IF EXISTS school_scope_restrictive ON public.staff_leaves;
CREATE POLICY school_scope_restrictive ON public.staff_leaves
AS RESTRICTIVE FOR ALL TO authenticated
USING (
  personnel_id IS NULL OR EXISTS (
    SELECT 1 FROM public.personnel p
    WHERE p.id = staff_leaves.personnel_id
      AND (p.school_id IS NULL OR p.school_id = public.get_user_school_id(auth.uid()))
  )
)
WITH CHECK (
  personnel_id IS NULL OR EXISTS (
    SELECT 1 FROM public.personnel p
    WHERE p.id = staff_leaves.personnel_id
      AND (p.school_id IS NULL OR p.school_id = public.get_user_school_id(auth.uid()))
  )
);

DROP POLICY IF EXISTS school_scope_restrictive ON public.exams;
CREATE POLICY school_scope_restrictive ON public.exams
AS RESTRICTIVE FOR ALL TO authenticated
USING (
  teacher_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = exams.classroom_id AND (c.school_id IS NULL OR c.school_id = public.get_user_school_id(auth.uid())))
  OR EXISTS (SELECT 1 FROM public.subjects s WHERE s.id = exams.subject_id AND (s.school_id IS NULL OR s.school_id = public.get_user_school_id(auth.uid())))
)
WITH CHECK (
  teacher_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = exams.classroom_id AND (c.school_id IS NULL OR c.school_id = public.get_user_school_id(auth.uid())))
  OR EXISTS (SELECT 1 FROM public.subjects s WHERE s.id = exams.subject_id AND (s.school_id IS NULL OR s.school_id = public.get_user_school_id(auth.uid())))
);

DROP POLICY IF EXISTS school_scope_restrictive ON public.exam_questions;
CREATE POLICY school_scope_restrictive ON public.exam_questions
AS RESTRICTIVE FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.exams e
  WHERE e.id = exam_questions.exam_id
    AND (
      e.teacher_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = e.classroom_id AND (c.school_id IS NULL OR c.school_id = public.get_user_school_id(auth.uid())))
      OR EXISTS (SELECT 1 FROM public.subjects s WHERE s.id = e.subject_id AND (s.school_id IS NULL OR s.school_id = public.get_user_school_id(auth.uid())))
    )
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.exams e
  WHERE e.id = exam_questions.exam_id
    AND (
      e.teacher_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = e.classroom_id AND (c.school_id IS NULL OR c.school_id = public.get_user_school_id(auth.uid())))
      OR EXISTS (SELECT 1 FROM public.subjects s WHERE s.id = e.subject_id AND (s.school_id IS NULL OR s.school_id = public.get_user_school_id(auth.uid())))
    )
));

DROP POLICY IF EXISTS school_scope_restrictive ON public.exam_sheets;
CREATE POLICY school_scope_restrictive ON public.exam_sheets
AS RESTRICTIVE FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.exams e
  WHERE e.id = exam_sheets.exam_id
    AND (
      e.teacher_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = e.classroom_id AND (c.school_id IS NULL OR c.school_id = public.get_user_school_id(auth.uid())))
      OR EXISTS (SELECT 1 FROM public.subjects s WHERE s.id = e.subject_id AND (s.school_id IS NULL OR s.school_id = public.get_user_school_id(auth.uid())))
    )
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.exams e
  WHERE e.id = exam_sheets.exam_id
    AND (
      e.teacher_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = e.classroom_id AND (c.school_id IS NULL OR c.school_id = public.get_user_school_id(auth.uid())))
      OR EXISTS (SELECT 1 FROM public.subjects s WHERE s.id = e.subject_id AND (s.school_id IS NULL OR s.school_id = public.get_user_school_id(auth.uid())))
    )
));

DROP POLICY IF EXISTS school_scope_restrictive ON public.exam_submissions;
CREATE POLICY school_scope_restrictive ON public.exam_submissions
AS RESTRICTIVE FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.exams e
  WHERE e.id = exam_submissions.exam_id
    AND (
      e.teacher_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = e.classroom_id AND (c.school_id IS NULL OR c.school_id = public.get_user_school_id(auth.uid())))
      OR EXISTS (SELECT 1 FROM public.subjects s WHERE s.id = e.subject_id AND (s.school_id IS NULL OR s.school_id = public.get_user_school_id(auth.uid())))
    )
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.exams e
  WHERE e.id = exam_submissions.exam_id
    AND (
      e.teacher_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.classrooms c WHERE c.id = e.classroom_id AND (c.school_id IS NULL OR c.school_id = public.get_user_school_id(auth.uid())))
      OR EXISTS (SELECT 1 FROM public.subjects s WHERE s.id = e.subject_id AND (s.school_id IS NULL OR s.school_id = public.get_user_school_id(auth.uid())))
    )
));