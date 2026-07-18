GRANT SELECT, INSERT, UPDATE, DELETE ON public.wall_posts TO authenticated;
GRANT SELECT ON public.wall_posts TO anon;
GRANT ALL ON public.wall_posts TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wall_post_reactions TO authenticated;
GRANT SELECT ON public.wall_post_reactions TO anon;
GRANT ALL ON public.wall_post_reactions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wall_post_comments TO authenticated;
GRANT SELECT ON public.wall_post_comments TO anon;
GRANT ALL ON public.wall_post_comments TO service_role;