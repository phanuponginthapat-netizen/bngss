ALTER TABLE public.schools 
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;