CREATE OR REPLACE FUNCTION public.same_school_as_owner(_owner uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _owner IS NULL
      OR public.get_user_school_id(_owner) IS NULL
      OR public.get_user_school_id(auth.uid()) IS NULL
      OR public.get_user_school_id(_owner) = public.get_user_school_id(auth.uid());
$$;
REVOKE ALL ON FUNCTION public.same_school_as_owner(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.same_school_as_owner(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "school scope for shared buckets" ON storage.objects;
CREATE POLICY "school scope for shared buckets" ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
USING (
  bucket_id NOT IN ('document-files','procurement-files','saraban-files','sar-evidences','mou-files','home-visit-photos','exam-scans','pa-files','asset-photos')
  OR public.same_school_as_owner(owner)
)
WITH CHECK (
  bucket_id NOT IN ('document-files','procurement-files','saraban-files','sar-evidences','mou-files','home-visit-photos','exam-scans','pa-files','asset-photos')
  OR public.same_school_as_owner(owner)
);