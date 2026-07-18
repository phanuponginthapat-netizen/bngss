ALTER TABLE public.pp5_files
  ADD COLUMN IF NOT EXISTS parsed_data JSONB,
  ADD COLUMN IF NOT EXISTS parse_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS announced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS announced_by UUID;

CREATE INDEX IF NOT EXISTS idx_pp5_files_announced_at ON public.pp5_files(announced_at);
CREATE INDEX IF NOT EXISTS idx_pp5_files_parse_status ON public.pp5_files(parse_status);