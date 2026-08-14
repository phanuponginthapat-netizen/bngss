ALTER TABLE public.student_offsite_trips
  ADD COLUMN IF NOT EXISTS destination_lat double precision,
  ADD COLUMN IF NOT EXISTS destination_lng double precision,
  ADD COLUMN IF NOT EXISTS destination_address text;

CREATE TABLE IF NOT EXISTS public.student_offsite_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.student_offsite_trips(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  caption text,
  lat double precision,
  lng double precision,
  taken_at timestamptz NOT NULL DEFAULT now(),
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_offsite_photos_trip ON public.student_offsite_photos(trip_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_offsite_photos TO authenticated;
GRANT ALL ON public.student_offsite_photos TO service_role;

ALTER TABLE public.student_offsite_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "offsite_photos_admin_all" ON public.student_offsite_photos
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role));

CREATE POLICY "offsite_photos_teacher_manage" ON public.student_offsite_photos
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'teacher'::app_role))
  WITH CHECK (has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "offsite_photos_student_read" ON public.student_offsite_photos
  FOR SELECT TO authenticated
  USING (trip_id IN (
    SELECT p.trip_id FROM public.student_offsite_participants p
    JOIN public.students s ON s.id = p.student_id
    WHERE s.auth_user_id = auth.uid()
  ));

DROP TRIGGER IF EXISTS trg_offsite_photos_updated ON public.student_offsite_photos;
CREATE TRIGGER trg_offsite_photos_updated
  BEFORE UPDATE ON public.student_offsite_photos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "offsite_photos_staff_read" ON storage.objects;
CREATE POLICY "offsite_photos_staff_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'offsite-photos');

DROP POLICY IF EXISTS "offsite_photos_staff_write" ON storage.objects;
CREATE POLICY "offsite_photos_staff_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'offsite-photos' AND (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role) OR has_role(auth.uid(), 'teacher'::app_role)
  ));

DROP POLICY IF EXISTS "offsite_photos_staff_delete" ON storage.objects;
CREATE POLICY "offsite_photos_staff_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'offsite-photos' AND (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role) OR has_role(auth.uid(), 'teacher'::app_role)
  ));