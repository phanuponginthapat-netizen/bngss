ALTER TABLE public.app_user_connections
  ADD COLUMN IF NOT EXISTS auth_mode TEXT NOT NULL DEFAULT 'gateway',
  ADD COLUMN IF NOT EXISTS refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS access_token TEXT,
  ADD COLUMN IF NOT EXISTS access_token_expires_at TIMESTAMPTZ;

ALTER TABLE public.app_user_connections ALTER COLUMN connection_key DROP NOT NULL;
ALTER TABLE public.app_user_connections ALTER COLUMN external_user_id DROP NOT NULL;

COMMENT ON COLUMN public.app_user_connections.auth_mode IS 'gateway = Lovable connector (legacy), google_oauth = native Google OAuth (standalone)';