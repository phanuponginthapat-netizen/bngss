
-- Maintain reaction_count and comment_count on wall_posts via triggers

CREATE OR REPLACE FUNCTION public.wall_post_reactions_count_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.wall_posts SET reaction_count = COALESCE(reaction_count,0) + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.wall_posts SET reaction_count = GREATEST(COALESCE(reaction_count,0) - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_wall_post_reactions_count ON public.wall_post_reactions;
CREATE TRIGGER trg_wall_post_reactions_count
AFTER INSERT OR DELETE ON public.wall_post_reactions
FOR EACH ROW EXECUTE FUNCTION public.wall_post_reactions_count_fn();

CREATE OR REPLACE FUNCTION public.wall_post_comments_count_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.wall_posts SET comment_count = COALESCE(comment_count,0) + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.wall_posts SET comment_count = GREATEST(COALESCE(comment_count,0) - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_wall_post_comments_count ON public.wall_post_comments;
CREATE TRIGGER trg_wall_post_comments_count
AFTER INSERT OR DELETE ON public.wall_post_comments
FOR EACH ROW EXECUTE FUNCTION public.wall_post_comments_count_fn();

-- Backfill counts
UPDATE public.wall_posts wp SET
  reaction_count = (SELECT COUNT(*) FROM public.wall_post_reactions WHERE post_id = wp.id),
  comment_count  = (SELECT COUNT(*) FROM public.wall_post_comments  WHERE post_id = wp.id);
