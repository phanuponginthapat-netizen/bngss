
CREATE TABLE IF NOT EXISTS public.game_hub_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  cover_url text,
  type text NOT NULL CHECK (type IN ('external_link','embed')),
  url text,
  embed_code text,
  min_grade int,
  max_grade int,
  min_age int,
  max_age int,
  tags text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  play_count int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_hub_games TO authenticated;
GRANT ALL ON public.game_hub_games TO service_role;
ALTER TABLE public.game_hub_games ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "games_read_active" ON public.game_hub_games;
DROP POLICY IF EXISTS "games_read_active" ON public.game_hub_games;
CREATE POLICY "games_read_active" ON public.game_hub_games FOR SELECT TO authenticated
  USING (is_active = true OR created_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));
DROP POLICY IF EXISTS "games_insert_teacher_admin" ON public.game_hub_games;
DROP POLICY IF EXISTS "games_insert_teacher_admin" ON public.game_hub_games;
CREATE POLICY "games_insert_teacher_admin" ON public.game_hub_games FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher')));
DROP POLICY IF EXISTS "games_update_owner_admin" ON public.game_hub_games;
DROP POLICY IF EXISTS "games_update_owner_admin" ON public.game_hub_games;
CREATE POLICY "games_update_owner_admin" ON public.game_hub_games FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));
DROP POLICY IF EXISTS "games_delete_owner_admin" ON public.game_hub_games;
DROP POLICY IF EXISTS "games_delete_owner_admin" ON public.game_hub_games;
CREATE POLICY "games_delete_owner_admin" ON public.game_hub_games FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));

CREATE TABLE IF NOT EXISTS public.game_hub_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.game_hub_games(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  auth_user_id uuid,
  score numeric NOT NULL DEFAULT 0,
  duration_sec int,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'in_app' CHECK (source IN ('in_app','external')),
  played_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ON public.game_hub_scores (game_id, score DESC);
CREATE INDEX IF NOT EXISTS ON public.game_hub_scores (student_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_hub_scores TO authenticated;
GRANT ALL ON public.game_hub_scores TO service_role;
ALTER TABLE public.game_hub_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scores_read_all_auth" ON public.game_hub_scores;
DROP POLICY IF EXISTS "scores_read_all_auth" ON public.game_hub_scores;
CREATE POLICY "scores_read_all_auth" ON public.game_hub_scores FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "scores_insert_self" ON public.game_hub_scores;
DROP POLICY IF EXISTS "scores_insert_self" ON public.game_hub_scores;
CREATE POLICY "scores_insert_self" ON public.game_hub_scores FOR INSERT TO authenticated
  WITH CHECK (auth_user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "scores_delete_admin" ON public.game_hub_scores;
DROP POLICY IF EXISTS "scores_delete_admin" ON public.game_hub_scores;
CREATE POLICY "scores_delete_admin" ON public.game_hub_scores FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.game_hub_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  key_hash text NOT NULL,
  key_prefix text NOT NULL,
  scopes text[] NOT NULL DEFAULT '{auth,submit,leaderboard}',
  is_active boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_hub_api_keys TO authenticated;
GRANT ALL ON public.game_hub_api_keys TO service_role;
ALTER TABLE public.game_hub_api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "apikeys_admin_only" ON public.game_hub_api_keys;
DROP POLICY IF EXISTS "apikeys_admin_only" ON public.game_hub_api_keys;
CREATE POLICY "apikeys_admin_only" ON public.game_hub_api_keys FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP TRIGGER IF EXISTS game_hub_games_updated_at ON public.game_hub_games;
CREATE TRIGGER game_hub_games_updated_at
  BEFORE UPDATE ON public.game_hub_games
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DO $$

BEGIN

  IF NOT EXISTS (

    SELECT 1 FROM pg_publication_tables

    WHERE pubname = 'supabase_realtime'

      AND schemaname = 'public'

      AND tablename = 'game_hub_scores'

  ) THEN

    ALTER PUBLICATION supabase_realtime ADD TABLE public.game_hub_scores;

  END IF;

END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'game_hub_games'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.game_hub_games;
  END IF;
END $$;