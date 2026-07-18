
CREATE TABLE IF NOT EXISTS public.webauthn_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id text NOT NULL UNIQUE,
  public_key text NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  transports text[] DEFAULT NULL,
  device_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_user ON public.webauthn_credentials(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.webauthn_credentials TO authenticated;
GRANT ALL ON public.webauthn_credentials TO service_role;

ALTER TABLE public.webauthn_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own passkeys"
  ON public.webauthn_credentials FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users delete own passkeys"
  ON public.webauthn_credentials FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.webauthn_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('register', 'authenticate')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_user ON public.webauthn_challenges(user_id);

GRANT ALL ON public.webauthn_challenges TO service_role;
ALTER TABLE public.webauthn_challenges ENABLE ROW LEVEL SECURITY;
