
-- 1. Face descriptors table
CREATE TABLE IF NOT EXISTS public.student_face_descriptors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  sample_index INTEGER NOT NULL DEFAULT 0,
  descriptor REAL[] NOT NULL,
  quality_score REAL,
  captured_by UUID,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, sample_index)
);
CREATE INDEX IF NOT EXISTS idx_face_desc_student ON public.student_face_descriptors(student_id);

ALTER TABLE public.student_face_descriptors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff manage face descriptors" ON public.student_face_descriptors
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'));

CREATE POLICY "students view own face desc" ON public.student_face_descriptors
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.auth_user_id = auth.uid()));

-- 2. Face scan logs
CREATE TABLE IF NOT EXISTS public.face_scan_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  scan_date DATE NOT NULL DEFAULT CURRENT_DATE,
  scan_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  scan_type TEXT NOT NULL DEFAULT 'entry',
  confidence REAL,
  scanned_by UUID,
  device_label TEXT,
  school_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_face_scan_date_student ON public.face_scan_logs(scan_date, student_id);
CREATE INDEX IF NOT EXISTS idx_face_scan_student ON public.face_scan_logs(student_id);

ALTER TABLE public.face_scan_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff manage scan logs" ON public.face_scan_logs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'));

CREATE POLICY "students view own scan logs" ON public.face_scan_logs
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_id AND s.auth_user_id = auth.uid()));

CREATE POLICY "parents view child scan logs" ON public.face_scan_logs
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.parent_student_links l WHERE l.student_id = face_scan_logs.student_id AND l.parent_user_id = auth.uid()));

-- 3. Auto-mark attendance trigger
CREATE OR REPLACE FUNCTION public.auto_attendance_on_face_scan()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  cls_id UUID;
  cur_year INT;
  cur_sem INT;
BEGIN
  IF NEW.scan_type NOT IN ('entry','assembly') THEN
    RETURN NEW;
  END IF;

  SELECT classroom_id INTO cls_id FROM public.students WHERE id = NEW.student_id;
  cur_year := EXTRACT(year FROM now())::int;
  cur_sem := CASE WHEN EXTRACT(month FROM now())::int BETWEEN 5 AND 10 THEN 1 ELSE 2 END;

  INSERT INTO public.attendance (student_id, classroom_id, attendance_date, status, subject_id, academic_year, semester, recorded_by, notes)
  VALUES (NEW.student_id, cls_id, NEW.scan_date, 'present', NULL, cur_year, cur_sem, NEW.scanned_by, 'face-scan')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_auto_attendance_face_scan
  AFTER INSERT ON public.face_scan_logs
  FOR EACH ROW EXECUTE FUNCTION public.auto_attendance_on_face_scan();

-- 4. Auto fill school_id
CREATE TRIGGER trg_face_scan_school_id
  BEFORE INSERT ON public.face_scan_logs
  FOR EACH ROW EXECUTE FUNCTION public.auto_fill_school_id();
