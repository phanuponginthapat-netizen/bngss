CREATE TABLE IF NOT EXISTS public.district_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  snapshot_type TEXT NOT NULL DEFAULT 'nightly',
  payload JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_district_snapshots_school_date ON public.district_snapshots(school_id, snapshot_date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_district_snapshots_school_date_type ON public.district_snapshots(COALESCE(school_id, '00000000-0000-0000-0000-000000000000'::uuid), snapshot_date, snapshot_type);

GRANT SELECT ON public.district_snapshots TO authenticated;
GRANT ALL ON public.district_snapshots TO service_role;

ALTER TABLE public.district_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read snapshots of their school" ON public.district_snapshots;
DROP POLICY IF EXISTS "Admins read snapshots of their school" ON public.district_snapshots;
CREATE POLICY "Admins read snapshots of their school"
ON public.district_snapshots FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'director')
);
