ALTER TABLE public.visitor_logs ADD COLUMN face_samples jsonb;
COMMENT ON COLUMN public.visitor_logs.face_samples IS 'Camera challenge samples (front, left, right, blink) with ArcFace embeddings; client motion evidence is not certified anti-spoof verification.';
CREATE OR REPLACE FUNCTION public.guard_visitor_face_identity() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE candidate jsonb; known jsonb; similarity double precision;
BEGIN
 IF NEW.face_samples IS NULL OR NEW.face_samples IS NOT DISTINCT FROM OLD.face_samples THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(49281378);
 FOR candidate IN SELECT value->'descriptor' FROM jsonb_array_elements(NEW.face_samples) LOOP
  FOR known IN SELECT descriptor FROM public.student_face_descriptors UNION ALL SELECT descriptor FROM public.personnel_face_descriptors UNION ALL SELECT face_embedding FROM public.visitor_logs WHERE id <> NEW.id AND face_embedding IS NOT NULL UNION ALL SELECT s.value->'descriptor' FROM public.visitor_logs v CROSS JOIN LATERAL jsonb_array_elements(v.face_samples) s WHERE v.id <> NEW.id LOOP
   IF jsonb_typeof(known) <> 'array' OR jsonb_array_length(known) <> 512 THEN CONTINUE; END IF;
   SELECT sum(a.v::double precision*b.v::double precision)/NULLIF(sqrt(sum(a.v::double precision*a.v::double precision)*sum(b.v::double precision*b.v::double precision)),0) INTO similarity FROM jsonb_array_elements_text(candidate) WITH ORDINALITY a(v,n) JOIN jsonb_array_elements_text(known) WITH ORDINALITY b(v,n) USING(n);
   IF similarity >= 0.5 THEN RAISE EXCEPTION 'visitor_face_already_registered'; END IF;
  END LOOP;
 END LOOP;
 RETURN NEW;
END;
$$;
CREATE TRIGGER visitor_face_identity_guard BEFORE INSERT OR UPDATE OF face_samples ON public.visitor_logs FOR EACH ROW EXECUTE FUNCTION public.guard_visitor_face_identity();