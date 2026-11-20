GRANT SELECT, INSERT, UPDATE, DELETE ON public.special_rooms TO authenticated;
GRANT ALL ON public.special_rooms TO service_role;
ALTER TABLE public.special_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manage rooms insert" ON public.special_rooms FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));
CREATE POLICY "Admin manage rooms update" ON public.special_rooms FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));
CREATE POLICY "Admin manage rooms delete" ON public.special_rooms FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));
ALTER TABLE public.room_bookings DROP CONSTRAINT room_bookings_room_id_fkey;
ALTER TABLE public.room_bookings ADD CONSTRAINT room_bookings_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.special_rooms(id) ON DELETE SET NULL;
CREATE POLICY "Referenced special room photos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id='asset-photos' AND EXISTS (SELECT 1 FROM public.special_rooms r WHERE r.image_url = 'asset-photos/' || storage.objects.name OR split_part(r.image_url, '?', 1) LIKE '%/storage/v1/object/sign/asset-photos/' || storage.objects.name OR split_part(r.image_url, '?', 1) LIKE '%/storage/v1/object/public/asset-photos/' || storage.objects.name));