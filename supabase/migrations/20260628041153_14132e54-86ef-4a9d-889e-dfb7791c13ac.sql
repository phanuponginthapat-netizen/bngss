ALTER TABLE public.activity_participants
  ADD COLUMN IF NOT EXISTS team_logo_url text,
  ADD COLUMN IF NOT EXISTS team_members jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_team_leader boolean NOT NULL DEFAULT false;