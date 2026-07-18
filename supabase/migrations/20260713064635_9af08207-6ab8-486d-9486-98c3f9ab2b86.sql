
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.profiles (id, first_name, last_name, is_approved, school_id)
SELECT u.id,
       COALESCE(u.raw_user_meta_data->>'first_name',''),
       COALESCE(u.raw_user_meta_data->>'last_name',''),
       true,
       (SELECT id FROM public.schools WHERE is_active = true ORDER BY created_at LIMIT 1)
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'teacher'::public.app_role
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
WHERE ur.user_id IS NULL
ON CONFLICT (user_id, role) DO NOTHING;
