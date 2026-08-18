DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename='school_settings' AND policyname='Users manage own first login flag') THEN
    DROP POLICY "Users manage own first login flag" ON public.school_settings;
  END IF;
END $$;

CREATE POLICY "Users manage own first login flag"
ON public.school_settings
FOR INSERT
TO authenticated
WITH CHECK (setting_key = 'first_login_done_' || auth.uid()::text);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename='school_settings' AND policyname='Users update own first login flag') THEN
    DROP POLICY "Users update own first login flag" ON public.school_settings;
  END IF;
END $$;

CREATE POLICY "Users update own first login flag"
ON public.school_settings
FOR UPDATE
TO authenticated
USING (setting_key = 'first_login_done_' || auth.uid()::text)
WITH CHECK (setting_key = 'first_login_done_' || auth.uid()::text);