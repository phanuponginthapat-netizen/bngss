CREATE TABLE public.fitness_sleep_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sleep_date DATE NOT NULL,
  bedtime TIMESTAMPTZ,
  wake_time TIMESTAMPTZ,
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  quality SMALLINT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fitness_sleep_logs TO authenticated;
GRANT ALL ON public.fitness_sleep_logs TO service_role;
ALTER TABLE public.fitness_sleep_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sleep logs" ON public.fitness_sleep_logs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_fitness_sleep_logs_user_date ON public.fitness_sleep_logs(user_id, sleep_date DESC);
CREATE TRIGGER update_fitness_sleep_logs_updated_at BEFORE UPDATE ON public.fitness_sleep_logs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER PUBLICATION supabase_realtime ADD TABLE public.fitness_sleep_logs;