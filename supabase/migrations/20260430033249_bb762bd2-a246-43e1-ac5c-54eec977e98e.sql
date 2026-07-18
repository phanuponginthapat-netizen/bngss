-- Mark test users as linked so they bypass the LinkAccount gate
UPDATE public.profiles
SET account_linked = true
WHERE id IN (
  SELECT id FROM auth.users WHERE email LIKE '%@test.school'
);

-- Assign teacher@test.school to ALL departments so they can access every teaching menu during tests
INSERT INTO public.user_departments (user_id, department, is_head)
SELECT u.id, d.dept, false
FROM auth.users u
CROSS JOIN (
  VALUES
    ('academic'::public.school_department),
    ('student_affairs'::public.school_department),
    ('general_admin'::public.school_department),
    ('finance_personnel'::public.school_department),
    ('director_office'::public.school_department)
) AS d(dept)
WHERE u.email = 'teacher@test.school'
ON CONFLICT DO NOTHING;