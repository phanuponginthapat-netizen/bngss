DROP POLICY IF EXISTS "wall author delete" ON public.wall_posts;
DROP POLICY IF EXISTS "wall author delete" ON public.wall_posts;
CREATE POLICY "wall author delete" ON public.wall_posts FOR DELETE TO authenticated USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));