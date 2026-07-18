
WITH latest_approved AS (
  SELECT DISTINCT ON (student_id)
    student_id,
    (photo_urls)[1] AS first_photo
  FROM public.face_registration_requests
  WHERE status = 'approved'
    AND photo_urls IS NOT NULL
    AND array_length(photo_urls, 1) > 0
  ORDER BY student_id, reviewed_at DESC NULLS LAST, created_at DESC
)
UPDATE public.students s
SET photo_url = la.first_photo
FROM latest_approved la
WHERE s.id = la.student_id
  AND (s.photo_url IS NULL OR s.photo_url = '')
  AND la.first_photo IS NOT NULL;
