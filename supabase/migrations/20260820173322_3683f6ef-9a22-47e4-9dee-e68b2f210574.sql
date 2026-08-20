
-- ============ PADLET NOTES: allow edit / delete / like ============
DROP POLICY IF EXISTS padlet_notes_update_own ON public.padlet_notes;
CREATE POLICY padlet_notes_update_own ON public.padlet_notes
FOR UPDATE TO authenticated
USING (
  author_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.padlet_boards b WHERE b.id = padlet_notes.board_id AND b.owner_id = auth.uid())
  OR public.is_admin_or_director()
)
WITH CHECK (
  author_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.padlet_boards b WHERE b.id = padlet_notes.board_id AND b.owner_id = auth.uid())
  OR public.is_admin_or_director()
);

DROP POLICY IF EXISTS padlet_notes_delete_own ON public.padlet_notes;
CREATE POLICY padlet_notes_delete_own ON public.padlet_notes
FOR DELETE TO authenticated
USING (
  author_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.padlet_boards b WHERE b.id = padlet_notes.board_id AND b.owner_id = auth.uid())
  OR public.is_admin_or_director()
);

DROP FUNCTION IF EXISTS public.padlet_like_note(uuid);
CREATE FUNCTION public.padlet_like_note(_note_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_likes integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  UPDATE public.padlet_notes SET likes = COALESCE(likes,0) + 1, updated_at = now()
  WHERE id = _note_id RETURNING likes INTO v_likes;
  RETURN COALESCE(v_likes, 0);
END; $$;
GRANT EXECUTE ON FUNCTION public.padlet_like_note(uuid) TO authenticated;

-- ============ HOMEWORK SUBMISSIONS: student_id is students.id, not auth uid ============
GRANT SELECT, INSERT, UPDATE, DELETE ON public.homework_submissions TO authenticated;
GRANT ALL ON public.homework_submissions TO service_role;

DROP POLICY IF EXISTS "students manage own submissions" ON public.homework_submissions;
CREATE POLICY "students manage own submissions" ON public.homework_submissions
FOR ALL TO authenticated
USING (student_id IN (SELECT s.id FROM public.students s WHERE s.auth_user_id = auth.uid()))
WITH CHECK (student_id IN (SELECT s.id FROM public.students s WHERE s.auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "parents view child submissions" ON public.homework_submissions;
CREATE POLICY "parents view child submissions" ON public.homework_submissions
FOR SELECT TO authenticated
USING (public.is_parent_of(auth.uid(), student_id));

DROP POLICY IF EXISTS "staff grade submissions" ON public.homework_submissions;
CREATE POLICY "staff grade submissions" ON public.homework_submissions
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director')
  OR (public.has_role(auth.uid(), 'teacher')
      AND (school_id IS NULL OR school_id = public.get_user_school_id(auth.uid())))
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director')
  OR (public.has_role(auth.uid(), 'teacher')
      AND (school_id IS NULL OR school_id = public.get_user_school_id(auth.uid())))
);

-- ============ HOMEWORK ASSIGNMENTS: teachers (not only academic dept) can manage ============
DROP POLICY IF EXISTS "teachers manage homework assignments" ON public.homework_assignments;
CREATE POLICY "teachers manage homework assignments" ON public.homework_assignments
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director')
  OR (public.has_role(auth.uid(), 'teacher')
      AND (school_id IS NULL OR school_id = public.get_user_school_id(auth.uid())))
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director')
  OR (public.has_role(auth.uid(), 'teacher')
      AND (school_id IS NULL OR school_id = public.get_user_school_id(auth.uid())))
);

-- ============ EXAMS: teacher owner + staff access ============
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exams, public.exam_questions, public.exam_sheets, public.exam_submissions TO authenticated;
GRANT ALL ON public.exams, public.exam_questions, public.exam_sheets, public.exam_submissions TO service_role;

DROP POLICY IF EXISTS "teachers manage own exams" ON public.exams;
CREATE POLICY "teachers manage own exams" ON public.exams
FOR ALL TO authenticated
USING (
  teacher_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director')
  OR public.has_role(auth.uid(), 'teacher')
)
WITH CHECK (
  teacher_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director')
  OR public.has_role(auth.uid(), 'teacher')
);

DROP POLICY IF EXISTS "staff manage exam questions" ON public.exam_questions;
CREATE POLICY "staff manage exam questions" ON public.exam_questions
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director') OR public.has_role(auth.uid(), 'teacher')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director') OR public.has_role(auth.uid(), 'teacher')
);

DROP POLICY IF EXISTS "staff manage exam sheets" ON public.exam_sheets;
CREATE POLICY "staff manage exam sheets" ON public.exam_sheets
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director') OR public.has_role(auth.uid(), 'teacher')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director') OR public.has_role(auth.uid(), 'teacher')
);

DROP POLICY IF EXISTS "staff manage exam submissions" ON public.exam_submissions;
CREATE POLICY "staff manage exam submissions" ON public.exam_submissions
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director') OR public.has_role(auth.uid(), 'teacher')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director') OR public.has_role(auth.uid(), 'teacher')
);
