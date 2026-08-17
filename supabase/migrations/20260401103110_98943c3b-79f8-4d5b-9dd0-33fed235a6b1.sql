
-- Account balances table
CREATE TABLE IF NOT EXISTS public.account_balances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_name TEXT NOT NULL,
  balance NUMERIC NOT NULL DEFAULT 0,
  fiscal_year INTEGER NOT NULL DEFAULT EXTRACT(year FROM now()),
  month INTEGER NOT NULL DEFAULT EXTRACT(month FROM now()),
  updated_by_user_id UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.account_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view account_balances"
  ON public.account_balances FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admin/Director can manage account_balances"
  ON public.account_balances FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role));

-- Asset damage reports table
CREATE TABLE IF NOT EXISTS public.asset_damage_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE NOT NULL,
  reported_by_user_id UUID REFERENCES auth.users(id),
  reporter_name TEXT,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.asset_damage_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can view damage reports"
  ON public.asset_damage_reports FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Auth users can create damage reports"
  ON public.asset_damage_reports FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Admin/Director can manage damage reports"
  ON public.asset_damage_reports FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'director'::app_role));

-- Add columns to assets
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS useful_life_years INTEGER DEFAULT 5;

-- Storage bucket for asset photos
INSERT INTO storage.buckets (id, name, public) VALUES ('asset-photos', 'asset-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view asset photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'asset-photos');

CREATE POLICY "Auth users can upload asset photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'asset-photos');

CREATE POLICY "Auth users can update asset photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'asset-photos');

CREATE POLICY "Auth users can delete asset photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'asset-photos');
