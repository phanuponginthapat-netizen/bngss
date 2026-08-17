DO $$
DECLARE b text;
BEGIN
  FOREACH b IN ARRAY ARRAY['cms-images','garbage-images','pdf-templates'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b||' public read');
    EXECUTE format('CREATE POLICY %I ON storage.objects FOR SELECT USING (bucket_id = %L)', b||' public read', b);
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b||' staff insert');
    EXECUTE format('CREATE POLICY %I ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = %L AND public.is_staff_user(auth.uid()))', b||' staff insert', b);
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b||' staff update');
    EXECUTE format('CREATE POLICY %I ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = %L AND public.is_staff_user(auth.uid()))', b||' staff update', b);
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b||' staff delete');
    EXECUTE format('CREATE POLICY %I ON storage.objects FOR DELETE TO authenticated USING (bucket_id = %L AND public.is_staff_user(auth.uid()))', b||' staff delete', b);
  END LOOP;

  FOREACH b IN ARRAY ARRAY['asset-photos','signatures'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b||' auth read');
    EXECUTE format('CREATE POLICY %I ON storage.objects FOR SELECT TO authenticated USING (bucket_id = %L)', b||' auth read', b);
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b||' staff insert');
    EXECUTE format('CREATE POLICY %I ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = %L AND public.is_staff_user(auth.uid()))', b||' staff insert', b);
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b||' staff update');
    EXECUTE format('CREATE POLICY %I ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = %L AND public.is_staff_user(auth.uid()))', b||' staff update', b);
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b||' staff delete');
    EXECUTE format('CREATE POLICY %I ON storage.objects FOR DELETE TO authenticated USING (bucket_id = %L AND public.is_staff_user(auth.uid()))', b||' staff delete', b);
  END LOOP;

  FOREACH b IN ARRAY ARRAY['document-files','mou-files','procurement-files','sar-evidences','saraban-files'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b||' staff read');
    EXECUTE format('CREATE POLICY %I ON storage.objects FOR SELECT TO authenticated USING (bucket_id = %L AND public.is_staff_user(auth.uid()))', b||' staff read', b);
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b||' staff insert');
    EXECUTE format('CREATE POLICY %I ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = %L AND public.is_staff_user(auth.uid()))', b||' staff insert', b);
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b||' staff update');
    EXECUTE format('CREATE POLICY %I ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = %L AND public.is_staff_user(auth.uid()))', b||' staff update', b);
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b||' staff delete');
    EXECUTE format('CREATE POLICY %I ON storage.objects FOR DELETE TO authenticated USING (bucket_id = %L AND public.is_staff_user(auth.uid()))', b||' staff delete', b);
  END LOOP;
END $$;
