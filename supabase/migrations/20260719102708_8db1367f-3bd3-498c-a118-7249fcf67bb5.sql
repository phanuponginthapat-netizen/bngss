
CREATE TABLE IF NOT EXISTS public.app_user_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connector_id TEXT NOT NULL,
  connection_key TEXT NOT NULL,
  external_user_id TEXT NOT NULL,
  account_email TEXT,
  account_name TEXT,
  scopes TEXT[],
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  UNIQUE(user_id, connector_id)
);

GRANT SELECT, DELETE ON public.app_user_connections TO authenticated;
GRANT ALL ON public.app_user_connections TO service_role;

ALTER TABLE public.app_user_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own connections"
  ON public.app_user_connections FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete their own connections"
  ON public.app_user_connections FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_app_user_connections_user ON public.app_user_connections(user_id, connector_id) WHERE revoked_at IS NULL;
