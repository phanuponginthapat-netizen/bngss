-- Run against the managed database; every test mutation is rolled back.
\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE sid uuid; uid uuid; old_photo text; old_avatar text; enrolled integer; evidence integer;
BEGIN
 SELECT s.id,p.id,s.photo_url,p.avatar_url INTO sid,uid,old_photo,old_avatar
 FROM public.students s JOIN public.profiles p ON p.student_code=s.student_code
 WHERE EXISTS(SELECT 1 FROM public.student_face_descriptors f WHERE f.student_id=s.id)
 LIMIT 1;
 IF sid IS NULL THEN RAISE EXCEPTION 'No enrolled linked student available for rollback test'; END IF;
 SELECT count(*) INTO enrolled FROM public.student_face_descriptors WHERE student_id=sid;
 SELECT count(*) INTO evidence FROM public.face_scan_logs WHERE student_id=sid;
 -- Same portrait must preserve enrollment.
 UPDATE public.students SET photo_url=old_photo WHERE id=sid;
 IF (SELECT count(*) FROM public.student_face_descriptors WHERE student_id=sid)<>enrolled
 THEN RAISE EXCEPTION 'Unchanged card photo deleted enrollment'; END IF;
 -- Card change must clear all registered samples without touching evidence.
 BEGIN
  UPDATE public.students SET photo_url='data:image/jpeg;base64,dGVzdA==' WHERE id=sid;
  IF EXISTS(SELECT 1 FROM public.student_face_descriptors WHERE student_id=sid)
  THEN RAISE EXCEPTION 'Changed card photo retained enrollment'; END IF;
  IF (SELECT count(*) FROM public.face_scan_logs WHERE student_id=sid)<>evidence
  THEN RAISE EXCEPTION 'Card change deleted attendance evidence'; END IF;
  RAISE EXCEPTION USING ERRCODE='ZX001',MESSAGE='rollback card subtest';
 EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
 END;
 -- Profile change also clears enrollment and synchronizes the card source.
 UPDATE public.profiles SET avatar_url='data:image/jpeg;base64,cHJvZmlsZQ==',avatar_full_url='data:image/jpeg;base64,cHJvZmlsZQ==' WHERE id=uid;
 IF EXISTS(SELECT 1 FROM public.student_face_descriptors WHERE student_id=sid)
 THEN RAISE EXCEPTION 'Changed profile photo retained enrollment'; END IF;
 IF (SELECT photo_url FROM public.students WHERE id=sid)<>'data:image/jpeg;base64,cHJvZmlsZQ=='
 THEN RAISE EXCEPTION 'New profile portrait did not reach card'; END IF;
 IF (SELECT count(*) FROM public.face_scan_logs WHERE student_id=sid)<>evidence
 THEN RAISE EXCEPTION 'Profile change deleted attendance evidence'; END IF;
END $$;
ROLLBACK;