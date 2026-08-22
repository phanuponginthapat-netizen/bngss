CREATE TABLE IF NOT EXISTS public.sms_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  to_number text NOT NULL,
  message text NOT NULL,
  provider text,
  status text DEFAULT 'sent',
  error_message text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view SMS logs" ON public.sms_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
