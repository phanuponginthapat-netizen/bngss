
-- Academic Calendar Events table
CREATE TABLE public.academic_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  end_date DATE,
  event_type TEXT NOT NULL DEFAULT 'activity',
  location TEXT,
  academic_year INTEGER DEFAULT EXTRACT(year FROM now()),
  semester INTEGER DEFAULT 1,
  created_by TEXT,
  is_notified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.academic_events ENABLE ROW LEVEL SECURITY;

-- RLS: Authenticated users can view all events
CREATE POLICY "Auth users can view academic_events"
  ON public.academic_events FOR SELECT TO authenticated
  USING (true);

-- RLS: Admin/Director can manage events
CREATE POLICY "Admin/Director can manage academic_events"
  ON public.academic_events FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'director'));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.academic_events;
