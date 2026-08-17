-- Seed default admin user (idempotent — runs safely on every remix)
DO $$
DECLARE
  admin_uid uuid;
  admin_email text := 'admin@school.com';
  admin_password text := 'Admin@1234';
BEGIN
  -- Check if admin already exists
  SELECT id INTO admin_uid FROM auth.users WHERE email = admin_email LIMIT 1;

  IF admin_uid IS NULL THEN
    admin_uid := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      admin_uid, 'authenticated', 'authenticated', admin_email,
      crypt(admin_password, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('first_name','ผู้ดูแล','last_name','ระบบ'),
      now(), now(), '', '', '', ''
    );

    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (
      gen_random_uuid(), admin_uid,
      jsonb_build_object('sub', admin_uid::text, 'email', admin_email, 'email_verified', true),
      'email', admin_uid::text, now(), now(), now()
    );
  END IF;

  -- Ensure profile exists
  INSERT INTO public.profiles (id, first_name, last_name, is_approved)
  VALUES (admin_uid, 'ผู้ดูแล', 'ระบบ', true)
  ON CONFLICT (id) DO UPDATE SET is_approved = true;

  -- Ensure admin role exists (and remove other roles for this user to keep it clean)
  DELETE FROM public.user_roles WHERE user_id = admin_uid AND role <> 'admin';
  INSERT INTO public.user_roles (user_id, role)
  VALUES (admin_uid, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;
