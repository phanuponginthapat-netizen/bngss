REVOKE EXECUTE ON FUNCTION public.notify_homeroom_on_ai_risk() FROM anon, authenticated, public;

DROP POLICY IF EXISTS "Borrower can view own ict loan photos" ON storage.objects;
DROP POLICY IF EXISTS "Borrower can view own ict loan photos" ON storage.objects;
CREATE POLICY "Borrower can view own ict loan photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'ict-loan-photos'
  AND EXISTS (
    SELECT 1
    FROM public.ict_loans l
    LEFT JOIN public.students s ON s.id = l.student_id
    LEFT JOIN public.personnel p ON p.id = l.personnel_id
    WHERE (l.borrow_photo_url LIKE '%' || storage.objects.name || '%'
           OR l.return_photo_url LIKE '%' || storage.objects.name || '%')
      AND (s.auth_user_id = auth.uid() OR p.user_id = auth.uid())
  )
);