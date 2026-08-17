
CREATE TABLE IF NOT EXISTS public.upstream_subscription (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'default',
  bundle_url text NOT NULL,
  auto_pull boolean NOT NULL DEFAULT true,
  last_version text,
  last_pulled_at timestamptz,
  last_status text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.upstream_subscription TO authenticated;
GRANT ALL ON public.upstream_subscription TO service_role;

ALTER TABLE public.upstream_subscription ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage upstream subscription" ON public.upstream_subscription;
DROP POLICY IF EXISTS "Admins manage upstream subscription" ON public.upstream_subscription;
CREATE POLICY "Admins manage upstream subscription"
  ON public.upstream_subscription
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

DROP TRIGGER IF EXISTS trg_upstream_subscription_updated ON public.upstream_subscription;
CREATE TRIGGER trg_upstream_subscription_updated
  BEFORE UPDATE ON public.upstream_subscription
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
