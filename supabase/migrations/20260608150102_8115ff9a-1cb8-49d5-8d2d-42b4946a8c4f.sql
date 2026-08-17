
-- Portfolio items
CREATE TABLE IF NOT EXISTS public.portfolio_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  media_type TEXT NOT NULL CHECK (media_type IN ('pdf','image','video','youtube','drive','link')),
  media_url TEXT NOT NULL,
  thumbnail_url TEXT,
  file_name TEXT,
  file_size BIGINT,
  display_mode TEXT NOT NULL DEFAULT 'preview' CHECK (display_mode IN ('preview','download','embed')),
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  visibility TEXT NOT NULL DEFAULT 'school' CHECK (visibility IN ('school','public','private')),
  view_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio_items TO authenticated;
GRANT SELECT ON public.portfolio_items TO anon;
GRANT ALL ON public.portfolio_items TO service_role;
ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "portfolio public read"   ON public.portfolio_items FOR SELECT USING (visibility='public');
CREATE POLICY "portfolio school read"   ON public.portfolio_items FOR SELECT TO authenticated USING (visibility IN ('school','public') AND (school_id IS NULL OR school_id = public.get_user_school_id(auth.uid())));
CREATE POLICY "portfolio owner read"    ON public.portfolio_items FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "portfolio owner write"   ON public.portfolio_items FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "portfolio owner update"  ON public.portfolio_items FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "portfolio owner delete"  ON public.portfolio_items FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_portfolio_updated BEFORE UPDATE ON public.portfolio_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS idx_portfolio_user ON public.portfolio_items(user_id, is_pinned DESC, sort_order, created_at DESC);
ALTER PUBLICATION supabase_realtime ADD TABLE public.portfolio_items;

-- Wall posts (user-generated feed, distinct from FB Page mirror social_posts)
CREATE TABLE IF NOT EXISTS public.wall_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  content TEXT,
  media_urls TEXT[] NOT NULL DEFAULT '{}',
  link_url TEXT,
  link_type TEXT,
  visibility TEXT NOT NULL DEFAULT 'school' CHECK (visibility IN ('school','public','private')),
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  reaction_count INT NOT NULL DEFAULT 0,
  comment_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wall_posts TO authenticated;
GRANT SELECT ON public.wall_posts TO anon;
GRANT ALL ON public.wall_posts TO service_role;
ALTER TABLE public.wall_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wall public read"  ON public.wall_posts FOR SELECT USING (visibility='public');
CREATE POLICY "wall school read"  ON public.wall_posts FOR SELECT TO authenticated USING (visibility IN ('school','public') AND (school_id IS NULL OR school_id = public.get_user_school_id(auth.uid())));
CREATE POLICY "wall author read"  ON public.wall_posts FOR SELECT TO authenticated USING (author_id = auth.uid());
CREATE POLICY "wall author write" ON public.wall_posts FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
CREATE POLICY "wall author update"ON public.wall_posts FOR UPDATE TO authenticated USING (author_id = auth.uid());
CREATE POLICY "wall author delete"ON public.wall_posts FOR DELETE TO authenticated USING (author_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_wall_posts_updated BEFORE UPDATE ON public.wall_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS idx_wall_posts_feed ON public.wall_posts(school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wall_posts_author ON public.wall_posts(author_id, created_at DESC);
ALTER PUBLICATION supabase_realtime ADD TABLE public.wall_posts;

-- Reactions
CREATE TABLE IF NOT EXISTS public.wall_post_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.wall_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL DEFAULT 'like' CHECK (reaction_type IN ('like','heart','wow','haha','sad','care')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wall_post_reactions TO authenticated;
GRANT ALL ON public.wall_post_reactions TO service_role;
ALTER TABLE public.wall_post_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reactions read"   ON public.wall_post_reactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "reactions write"  ON public.wall_post_reactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "reactions update" ON public.wall_post_reactions FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "reactions delete" ON public.wall_post_reactions FOR DELETE TO authenticated USING (user_id = auth.uid());
ALTER PUBLICATION supabase_realtime ADD TABLE public.wall_post_reactions;

-- Comments
CREATE TABLE IF NOT EXISTS public.wall_post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.wall_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.wall_post_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wall_post_comments TO authenticated;
GRANT ALL ON public.wall_post_comments TO service_role;
ALTER TABLE public.wall_post_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments read"   ON public.wall_post_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "comments write"  ON public.wall_post_comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "comments update" ON public.wall_post_comments FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "comments delete" ON public.wall_post_comments FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_wall_comments_updated BEFORE UPDATE ON public.wall_post_comments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS idx_wall_comments_post ON public.wall_post_comments(post_id, created_at);
ALTER PUBLICATION supabase_realtime ADD TABLE public.wall_post_comments;

-- Counters
CREATE OR REPLACE FUNCTION public.wall_post_counters() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pid uuid;
BEGIN
  IF TG_TABLE_NAME = 'wall_post_reactions' THEN
    pid := COALESCE(NEW.post_id, OLD.post_id);
    UPDATE public.wall_posts SET reaction_count = (SELECT COUNT(*) FROM public.wall_post_reactions WHERE post_id=pid) WHERE id=pid;
  ELSIF TG_TABLE_NAME = 'wall_post_comments' THEN
    pid := COALESCE(NEW.post_id, OLD.post_id);
    UPDATE public.wall_posts SET comment_count = (SELECT COUNT(*) FROM public.wall_post_comments WHERE post_id=pid) WHERE id=pid;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_react_count AFTER INSERT OR DELETE OR UPDATE ON public.wall_post_reactions FOR EACH ROW EXECUTE FUNCTION public.wall_post_counters();
CREATE TRIGGER trg_comm_count  AFTER INSERT OR DELETE ON public.wall_post_comments FOR EACH ROW EXECUTE FUNCTION public.wall_post_counters();

-- Auto-fill school_id from author profile
CREATE OR REPLACE FUNCTION public.fill_wall_school() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.school_id IS NULL THEN
    SELECT school_id INTO NEW.school_id FROM public.profiles WHERE id = NEW.author_id LIMIT 1;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_fill_wall_school BEFORE INSERT ON public.wall_posts FOR EACH ROW EXECUTE FUNCTION public.fill_wall_school();

CREATE OR REPLACE FUNCTION public.fill_portfolio_school() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.school_id IS NULL THEN
    SELECT school_id INTO NEW.school_id FROM public.profiles WHERE id = NEW.user_id LIMIT 1;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_fill_portfolio_school BEFORE INSERT ON public.portfolio_items FOR EACH ROW EXECUTE FUNCTION public.fill_portfolio_school();
