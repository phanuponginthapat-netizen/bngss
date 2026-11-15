CREATE OR REPLACE FUNCTION public.get_my_face_identity()
RETURNS TABLE(kind text, person_id uuid, code text, prefix text, first_name text, last_name text, photo_url text, classroom_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO public
AS $$ BEGIN
IF auth.uid() IS NULL THEN RETURN; END IF;
RETURN QUERY SELECT 'student'::text,s.id,s.student_code,s.prefix,s.first_name,s.last_name,s.photo_url,c.name FROM public.students s LEFT JOIN public.classrooms c ON c.id=s.classroom_id WHERE s.auth_user_id=auth.uid();
IF FOUND THEN RETURN; END IF;
RETURN QUERY SELECT 'personnel'::text,p.id,p.employee_code,p.prefix,p.first_name,p.last_name,pr.avatar_url,NULL::text FROM public.personnel p LEFT JOIN public.profiles pr ON pr.id=p.user_id WHERE p.user_id=auth.uid();
END; $$;
REVOKE ALL ON FUNCTION public.get_my_face_identity() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_face_identity() TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.check_face_duplicate(_student_id uuid,_descriptors jsonb,_threshold real DEFAULT 0.42)
RETURNS TABLE(match_student_id uuid, match_code text, match_name text, min_distance real)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO public AS $$
DECLARE elem jsonb; probe real[]; best_id uuid; best_dist real:=1e9; r record;
BEGIN
IF COALESCE(auth.role(),'') <> 'service_role' AND NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher')) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
IF _descriptors IS NULL OR jsonb_typeof(_descriptors)<>'array' THEN RETURN; END IF;
FOR elem IN SELECT value FROM jsonb_array_elements(_descriptors) LOOP
SELECT array_agg(v::real ORDER BY ord) INTO probe FROM jsonb_array_elements_text(elem) WITH ORDINALITY AS t(v,ord);
CONTINUE WHEN probe IS NULL OR array_length(probe,1)<>128;
SELECT d.student_id,public.face_distance(d.descriptor::real[],probe) AS dist INTO r FROM public.student_face_descriptors d WHERE (_student_id IS NULL OR d.student_id<>_student_id) AND array_length(d.descriptor,1)=128 ORDER BY 2 ASC LIMIT 1;
IF r.student_id IS NOT NULL AND r.dist<best_dist THEN best_dist:=r.dist; best_id:=r.student_id; END IF;
END LOOP;
IF best_id IS NOT NULL AND best_dist<=_threshold THEN RETURN QUERY SELECT s.id,s.student_code,btrim(concat_ws(' ',concat(coalesce(s.prefix,''),s.first_name),s.last_name)),best_dist FROM public.students s WHERE s.id=best_id; END IF;
RETURN; END; $$;
REVOKE ALL ON FUNCTION public.check_face_duplicate(uuid,jsonb,real) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.check_face_duplicate(uuid,jsonb,real) TO authenticated,service_role;