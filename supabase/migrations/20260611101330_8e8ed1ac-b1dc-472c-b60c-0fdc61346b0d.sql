DROP POLICY IF EXISTS "Users update own profile (preserve must_change_password)" ON public.profiles;

CREATE POLICY "Users update own profile (no escalate must_change_password)"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND (
    -- allow clearing the flag (false), but never raising it to true via self-update
    must_change_password = false
    OR must_change_password IS NOT DISTINCT FROM (
      SELECT p.must_change_password FROM public.profiles p WHERE p.id = auth.uid()
    )
  )
);