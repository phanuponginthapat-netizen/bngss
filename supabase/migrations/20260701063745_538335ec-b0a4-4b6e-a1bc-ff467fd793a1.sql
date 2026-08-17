
DROP POLICY IF EXISTS "game_covers_auth_read" ON storage.objects;
CREATE POLICY "game_covers_auth_read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'game-covers');
DROP POLICY IF EXISTS "game_covers_auth_write" ON storage.objects;
CREATE POLICY "game_covers_auth_write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'game-covers');
DROP POLICY IF EXISTS "game_covers_owner_update" ON storage.objects;
CREATE POLICY "game_covers_owner_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'game-covers' AND owner = auth.uid());
DROP POLICY IF EXISTS "game_covers_owner_delete" ON storage.objects;
CREATE POLICY "game_covers_owner_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'game-covers' AND (owner = auth.uid() OR public.has_role(auth.uid(),'admin')));
