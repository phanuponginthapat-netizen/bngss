
ALTER TABLE public.padlet_boards
  ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS classroom_id uuid REFERENCES public.classrooms(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_padlet_boards_scope ON public.padlet_boards(classroom_id, subject_id);

-- Security definer helper: can current user see a scoped board?
CREATE OR REPLACE FUNCTION public.padlet_can_view_board(_board_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b record;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN false; END IF;

  SELECT owner_id, subject_id, classroom_id INTO b
  FROM public.padlet_boards WHERE id = _board_id;
  IF NOT FOUND THEN RETURN false; END IF;

  -- Owner / admins / directors always
  IF b.owner_id = uid
     OR public.has_role(uid, 'admin')
     OR public.has_role(uid, 'director') THEN
    RETURN true;
  END IF;

  -- School-wide board (no scope) → all authenticated
  IF b.subject_id IS NULL AND b.classroom_id IS NULL THEN
    RETURN true;
  END IF;

  -- Teacher assigned to this subject+classroom
  IF EXISTS (
    SELECT 1 FROM public.teacher_assignments ta
    JOIN public.personnel p ON p.id = ta.personnel_id
    WHERE p.user_id = uid
      AND (b.subject_id IS NULL OR ta.subject_id = b.subject_id)
      AND (b.classroom_id IS NULL OR ta.classroom_id = b.classroom_id)
  ) THEN
    RETURN true;
  END IF;

  -- Student enrolled in this subject+classroom (or homeroom match when subject null)
  IF EXISTS (
    SELECT 1 FROM public.students s
    LEFT JOIN public.enrollments e ON e.student_id = s.id
    WHERE s.auth_user_id = uid
      AND (
        (b.subject_id IS NOT NULL AND e.subject_id = b.subject_id
          AND (b.classroom_id IS NULL OR e.classroom_id = b.classroom_id))
        OR
        (b.subject_id IS NULL AND b.classroom_id IS NOT NULL AND s.classroom_id = b.classroom_id)
      )
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.padlet_can_view_board(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.padlet_can_view_board(uuid) TO authenticated;

-- Replace board SELECT policy with scope-aware one
DROP POLICY IF EXISTS "boards viewable by authenticated" ON public.padlet_boards;
CREATE POLICY "boards viewable by scope"
ON public.padlet_boards FOR SELECT
TO authenticated
USING (public.padlet_can_view_board(id));

-- Notes: viewable only if user can view parent board
DROP POLICY IF EXISTS "notes viewable by authenticated" ON public.padlet_notes;
CREATE POLICY "notes viewable by board scope"
ON public.padlet_notes FOR SELECT
TO authenticated
USING (public.padlet_can_view_board(board_id));

-- Notes: authenticated can post only if they can view board AND board allows guest post (or they own board)
DROP POLICY IF EXISTS "authenticated can post notes" ON public.padlet_notes;
CREATE POLICY "scoped users can post notes"
ON public.padlet_notes FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = author_id
  AND public.padlet_can_view_board(board_id)
  AND EXISTS (
    SELECT 1 FROM public.padlet_boards b
    WHERE b.id = board_id AND (b.allow_guest_post = true OR b.owner_id = auth.uid())
  )
);
