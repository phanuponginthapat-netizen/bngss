ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS central_hub_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS central_hub_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS central_hub_consent_by uuid;