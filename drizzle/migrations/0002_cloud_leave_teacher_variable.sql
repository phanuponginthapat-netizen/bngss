CREATE OR REPLACE FUNCTION public.auto_create_substitute_on_leave_approval()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE d date; v_teacher_name text; sched RECORD; dow int; chosen text;
BEGIN
 IF NEW.status = 'approved' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'approved') THEN
 SELECT CONCAT(prefix, first_name, ' ', last_name) INTO v_teacher_name FROM public.personnel WHERE id = NEW.personnel_id;
 d := NEW.start_date;
 WHILE d <= NEW.end_date LOOP
 dow := (EXTRACT(DOW FROM d)::int + 6) % 7 + 1;
 FOR sched IN SELECT s.id,s.subject_id,s.classroom_id,s.period FROM public.schedules s WHERE s.teacher_name=v_teacher_name AND s.day_of_week=dow AND EXISTS(SELECT 1 FROM public.resolve_school_term(d) term WHERE s.academic_year=term.academic_year_be-543 AND s.semester=term.semester) ORDER BY s.period LOOP
 SELECT NULLIF(TRIM(e->>'teacher'),'') INTO chosen FROM jsonb_array_elements(COALESCE(NEW.substitute_plan,'[]'::jsonb)) e WHERE e->>'date'=d::text AND (e->>'period')::int=sched.period LIMIT 1;
 IF chosen IS NULL AND COALESCE(NEW.acting_teacher,'') NOT IN('','none') THEN chosen:=NEW.acting_teacher; END IF;
 IF chosen IS NULL THEN chosen:=public.pick_auto_substitute(dow,sched.period,NEW.personnel_id,sched.subject_id); END IF;
 INSERT INTO public.substitute_teaching(original_teacher,substitute_teacher,subject_id,classroom_id,teaching_date,period,status,notes,leave_id) VALUES(v_teacher_name,chosen,sched.subject_id,sched.classroom_id,d,'คาบ '||sched.period,CASE WHEN chosen IS NULL THEN 'pending' ELSE 'confirmed' END,'สร้างอัตโนมัติจากคำลา '||NEW.leave_type,NEW.id) ON CONFLICT(original_teacher,teaching_date,period) DO UPDATE SET substitute_teacher=COALESCE(EXCLUDED.substitute_teacher,public.substitute_teaching.substitute_teacher),status=CASE WHEN EXCLUDED.substitute_teacher IS NOT NULL THEN 'confirmed' ELSE public.substitute_teaching.status END,leave_id=EXCLUDED.leave_id;
 chosen:=NULL;
 END LOOP;
 d:=d+1;
 END LOOP;
 END IF;
 RETURN NEW;
END $function$;