-- ปิดช่องโหว่ mutable search_path ของฟังก์ชัน SECURITY DEFINER ที่ตกหล่น
alter function public.get_teacher_observation_score(uuid) set search_path = public;
alter function public.get_trend_analytics() set search_path = public;
alter function public.upsert_early_warning(uuid, text, jsonb, integer, jsonb) set search_path = public;
