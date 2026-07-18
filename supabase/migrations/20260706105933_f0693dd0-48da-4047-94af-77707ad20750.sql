
-- Partial index for the common "active students" filter (used in dashboards, lists, counts)
CREATE INDEX IF NOT EXISTS idx_students_active
  ON public.students (school_id, classroom_id)
  WHERE status = 'active';

-- Composite index for status filter fallback
CREATE INDEX IF NOT EXISTS idx_students_status_school
  ON public.students (status, school_id);
