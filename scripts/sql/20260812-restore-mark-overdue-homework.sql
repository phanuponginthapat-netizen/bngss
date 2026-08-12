-- Restore mark_overdue_homework_columns() on the production backend.
-- Called by src/pages/academic/Pp5Page.tsx on load; missing after the migration
-- to the school's own Supabase project.
CREATE OR REPLACE FUNCTION public.mark_overdue_homework_columns()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH updated AS (
    UPDATE public.student_column_scores scs
       SET status = 'overdue', score = 0
      FROM public.subject_score_columns col
      JOIN public.homework_assignments ha ON ha.id = col.homework_assignment_id
     WHERE scs.column_id = col.id
       AND scs.status = 'pending'
       AND ha.due_date IS NOT NULL
       AND ha.due_date < (CURRENT_DATE)::date
    RETURNING scs.id
  )
  SELECT COUNT(*) INTO v_count FROM updated;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_overdue_homework_columns() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_overdue_homework_columns() FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_overdue_homework_columns() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_overdue_homework_columns() TO service_role;
