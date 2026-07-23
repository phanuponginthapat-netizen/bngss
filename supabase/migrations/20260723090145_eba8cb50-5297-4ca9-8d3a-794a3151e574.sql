
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'cms_menu_items','cms_pages','pdf_templates','print_templates','form_templates',
    'clubs','coop_members','coop_transactions','cafeteria_menus','library_books','library_loans',
    'scholarships','scholarship_awards','garbage_items','garbage_rewards','garbage_badges',
    'sports_day_meets','sports_day_houses','sports_day_house_members','sports_day_bonus_points',
    'duty_locations','attendance_auto_holidays','emergency_broadcasts','bus_stops','bus_students',
    'learning_contents','exercise_catalog','food_catalog','role_notification_defaults',
    'subject_group_heads','teaching_reflection_signature_settings','fitness_achievements',
    'club_advisors','club_announcements','club_works','activities','activity_matches','activity_posts',
    'browser_shortcuts'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Admins can manage %I" ON public.%I', t, t);
    EXECUTE format($f$
      CREATE POLICY "Admins can manage %1$I" ON public.%1$I
        FOR ALL TO authenticated
        USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
        WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
    $f$, t);
  END LOOP;
END $$;
