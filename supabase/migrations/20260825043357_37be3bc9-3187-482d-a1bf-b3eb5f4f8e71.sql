-- Ensure ar_projects exists with all columns
CREATE TABLE IF NOT EXISTS public.ar_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  title text NOT NULL,
  description text,
  cover_url text,
  location text,
  targets_url text,
  targets_version integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_public boolean NOT NULL DEFAULT true,
  school_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ar_projects
  ADD COLUMN IF NOT EXISTS targets_url text,
  ADD COLUMN IF NOT EXISTS targets_version integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cover_url text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS school_id uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS ar_projects_slug_key ON public.ar_projects (slug);

-- Ensure ar_experiences columns
ALTER TABLE public.ar_experiences
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS project_id uuid,
  ADD COLUMN IF NOT EXISTS marker_label text,
  ADD COLUMN IF NOT EXISTS marker_image_url text,
  ADD COLUMN IF NOT EXISTS target_index integer,
  ADD COLUMN IF NOT EXISTS overlay_width numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS overlay_height numeric NOT NULL DEFAULT 0.5625,
  ADD COLUMN IF NOT EXISTS autoplay boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS loop_media boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS muted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS poster_url text,
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS grade_level text,
  ADD COLUMN IF NOT EXISTS tags text[],
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS school_id uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ar_experiences_project_id_fkey'
  ) THEN
    ALTER TABLE public.ar_experiences
      ADD CONSTRAINT ar_experiences_project_id_fkey
      FOREIGN KEY (project_id) REFERENCES public.ar_projects(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ar_experiences_code_key ON public.ar_experiences (code);
CREATE INDEX IF NOT EXISTS ar_experiences_project_idx ON public.ar_experiences (project_id, sort_order);

GRANT SELECT ON public.ar_projects TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ar_projects TO authenticated;
GRANT ALL ON public.ar_projects TO service_role;
GRANT SELECT ON public.ar_experiences TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ar_experiences TO authenticated;
GRANT ALL ON public.ar_experiences TO service_role;

ALTER TABLE public.ar_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ar_experiences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ar_projects' AND policyname='ar_projects_public_read') THEN
    CREATE POLICY "ar_projects_public_read" ON public.ar_projects FOR SELECT USING (is_public AND is_active);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ar_projects' AND policyname='ar_projects_staff_manage') THEN
    CREATE POLICY "ar_projects_staff_manage" ON public.ar_projects FOR ALL TO authenticated
      USING (public.is_staff_any(auth.uid())) WITH CHECK (public.is_staff_any(auth.uid()));
  END IF;
END $$;
