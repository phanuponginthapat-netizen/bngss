GRANT SELECT, INSERT, DELETE ON public.learning_center_bookings TO authenticated;
GRANT ALL ON public.learning_center_bookings TO service_role;
ALTER TABLE public.learning_center_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff create own room bookings" ON public.learning_center_bookings FOR INSERT TO authenticated WITH CHECK (
 (public.has_role(auth.uid(),'teacher') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
 AND created_by=auth.uid()
 AND EXISTS (SELECT 1 FROM public.personnel p WHERE p.id=teacher_id AND p.user_id=auth.uid())
 AND EXISTS (SELECT 1 FROM public.special_rooms r WHERE r.id=room_id AND r.is_active AND (r.school_id IS NULL OR r.school_id=public.get_user_school_id(auth.uid())))
);
CREATE POLICY "Staff cancel authorized room bookings" ON public.learning_center_bookings FOR DELETE TO authenticated USING (
 public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR (public.has_role(auth.uid(),'teacher') AND created_by=auth.uid())
);