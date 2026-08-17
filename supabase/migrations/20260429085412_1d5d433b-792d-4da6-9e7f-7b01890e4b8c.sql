-- PDPA Consent tracking table
CREATE TABLE IF NOT EXISTS public.pdpa_consents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  consent_version TEXT NOT NULL DEFAULT '1.0',
  accepted BOOLEAN NOT NULL DEFAULT true,
  accepted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pdpa_consents_user ON public.pdpa_consents(user_id, accepted_at DESC);

ALTER TABLE public.pdpa_consents ENABLE ROW LEVEL SECURITY;

-- Users can view their own consents
DROP POLICY IF EXISTS "Users can view own pdpa consents" ON public.pdpa_consents;
CREATE POLICY "Users can view own pdpa consents"
ON public.pdpa_consents FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own consents
DROP POLICY IF EXISTS "Users can insert own pdpa consents" ON public.pdpa_consents;
CREATE POLICY "Users can insert own pdpa consents"
ON public.pdpa_consents FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Admins/Directors can view all consents (audit)
DROP POLICY IF EXISTS "Admins can view all pdpa consents" ON public.pdpa_consents;
CREATE POLICY "Admins can view all pdpa consents"
ON public.pdpa_consents FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

-- Add must_change_password flag to profiles for forced password reset by admin
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pdpa_accepted_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pdpa_version TEXT;