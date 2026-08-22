CREATE TABLE IF NOT EXISTS public.petty_cash (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL DEFAULT CURRENT_DATE,
  description text NOT NULL,
  amount numeric NOT NULL,
  type text NOT NULL CHECK (type IN ('in', 'out')),
  category text,
  receipt_no text,
  recorded_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.petty_cash ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage petty cash" ON public.petty_cash FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
