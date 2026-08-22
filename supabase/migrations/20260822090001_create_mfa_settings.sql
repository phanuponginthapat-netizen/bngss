CREATE TABLE IF NOT EXISTS public.mfa_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  totp_secret text,
  backup_codes text[],
  enabled boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.mfa_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own MFA" ON public.mfa_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own MFA" ON public.mfa_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own MFA" ON public.mfa_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
