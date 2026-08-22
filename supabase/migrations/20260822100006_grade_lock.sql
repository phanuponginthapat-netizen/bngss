-- Grade lock workflow — OBEC 80% attendance threshold before announcing PP5/PP6
-- Table: grade_lock (id, classroom_id, term, locked_at, locked_by, status)

CREATE TABLE IF NOT EXISTS public.grade_lock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id uuid NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
  term text NOT NULL,
  academic_year integer,
  semester integer,
  locked_at timestamptz NOT NULL DEFAULT now(),
  locked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'locked' CHECK (status IN ('locked','unlocked','pending')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (classroom_id, term)
);

CREATE INDEX IF NOT EXISTS idx_grade_lock_classroom ON public.grade_lock(classroom_id);
CREATE INDEX IF NOT EXISTS idx_grade_lock_term ON public.grade_lock(term);
CREATE INDEX IF NOT EXISTS idx_grade_lock_status ON public.grade_lock(status);
CREATE INDEX IF NOT EXISTS idx_grade_lock_locked_at ON public.grade_lock(locked_at DESC);

-- Updated at trigger
CREATE OR REPLACE FUNCTION public.set_grade_lock_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_grade_lock_updated_at ON public.grade_lock;
CREATE TRIGGER trg_grade_lock_updated_at
  BEFORE UPDATE ON public.grade_lock
  FOR EACH ROW EXECUTE FUNCTION public.set_grade_lock_updated_at();

-- RLS
ALTER TABLE public.grade_lock ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view grade_lock" ON public.grade_lock;
CREATE POLICY "Authenticated can view grade_lock"
  ON public.grade_lock FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Teachers can manage grade_lock" ON public.grade_lock;
CREATE POLICY "Teachers can manage grade_lock"
  ON public.grade_lock FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin','director','teacher')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin','director','teacher')
    )
  );

DROP POLICY IF EXISTS "Admins can delete grade_lock" ON public.grade_lock;
CREATE POLICY "Admins can delete grade_lock"
  ON public.grade_lock FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin','director')
    )
  );

COMMENT ON TABLE public.grade_lock IS 'ล็อกผลการเรียนรายห้อง/เทอม — ต้องผ่านเกณฑ์เวลาเรียน 80% ก่อนประกาศ ปพ.5/ปพ.6';
COMMENT ON COLUMN public.grade_lock.term IS 'ภาคเรียน เช่น 1/2568 หรือ 2568-1';
COMMENT ON COLUMN public.grade_lock.status IS 'locked=ล็อกแล้ว / unlocked=ปลดล็อก / pending=รอตรวจสอบ';
