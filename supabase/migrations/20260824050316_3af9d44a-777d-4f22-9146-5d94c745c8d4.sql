REVOKE EXECUTE ON FUNCTION public.calculate_late_minutes(uuid, date, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_set_late_minutes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_parent_on_absence() FROM PUBLIC, anon, authenticated;