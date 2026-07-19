DO $$
DECLARE
  obs_uid uuid;
  obs_email text := 'observer@school.com';
  obs_password text := 'Observer@2026';
BEGIN
  SELECT id INTO obs_uid FROM auth.users WHERE email = obs_email LIMIT 1;

  IF obs_uid IS NULL THEN
    obs_uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      obs_uid, 'authenticated', 'authenticated', obs_email,
      crypt(obs_password, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('first_name','ผู้สังเกตการณ์','last_name','ศึกษานิเทศก์'),
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (
      gen_random_uuid(), obs_uid,
      jsonb_build_object('sub', obs_uid::text, 'email', obs_email, 'email_verified', true),
      'email', obs_uid::text, now(), now(), now()
    );
  ELSE
    UPDATE auth.users
      SET encrypted_password = crypt(obs_password, gen_salt('bf')),
          email_confirmed_at = COALESCE(email_confirmed_at, now()),
          updated_at = now()
      WHERE id = obs_uid;
  END IF;

  INSERT INTO public.profiles (id, first_name, last_name, is_approved)
  VALUES (obs_uid, 'ผู้สังเกตการณ์', 'ศึกษานิเทศก์', true)
  ON CONFLICT (id) DO UPDATE SET is_approved = true;

  DELETE FROM public.user_roles
    WHERE user_id = obs_uid AND role NOT IN ('observer','director');
  INSERT INTO public.user_roles (user_id, role) VALUES (obs_uid, 'observer')
    ON CONFLICT (user_id, role) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (obs_uid, 'director')
    ON CONFLICT (user_id, role) DO NOTHING;
END $$;