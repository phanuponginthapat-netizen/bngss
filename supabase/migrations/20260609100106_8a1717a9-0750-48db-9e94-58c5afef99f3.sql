
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_test_scores TO authenticated;
GRANT ALL ON public.school_test_scores TO service_role;

DROP POLICY IF EXISTS "Admin manage test scores" ON public.school_test_scores;
DROP POLICY IF EXISTS "Admin manage test scores" ON public.school_test_scores;
CREATE POLICY "Admin manage test scores"
ON public.school_test_scores
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director'));

DO $$

BEGIN

  IF NOT EXISTS (

    SELECT 1 FROM pg_publication_tables

    WHERE pubname = 'supabase_realtime'

      AND schemaname = 'public'

      AND tablename = 'school_test_scores'

  ) THEN

    ALTER PUBLICATION supabase_realtime ADD TABLE public.school_test_scores;

  END IF;

END $$;