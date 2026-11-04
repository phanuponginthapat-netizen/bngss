CREATE TABLE public.personnel_work_templates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL DEFAULT auth.uid(),
 title text NOT NULL,
 position_title text NOT NULL,
 scopes text[] NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.personnel_work_templates TO authenticated;
GRANT ALL ON public.personnel_work_templates TO service_role;
ALTER TABLE public.personnel_work_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_staff_templates ON public.personnel_work_templates FOR ALL TO authenticated
 USING (user_id = (SELECT auth.uid()) AND (public.has_role((SELECT auth.uid()), 'teacher') OR public.has_role((SELECT auth.uid()), 'admin') OR public.has_role((SELECT auth.uid()), 'director')) AND NOT public.has_role((SELECT auth.uid()), 'observer'))
 WITH CHECK (user_id = (SELECT auth.uid()) AND (public.has_role((SELECT auth.uid()), 'teacher') OR public.has_role((SELECT auth.uid()), 'admin') OR public.has_role((SELECT auth.uid()), 'director')) AND NOT public.has_role((SELECT auth.uid()), 'observer'));
CREATE TABLE public.personnel_daily_work_logs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL DEFAULT auth.uid(),
 work_date date NOT NULL,
 template_id uuid NOT NULL,
 position_title text NOT NULL,
 items jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id, work_date),
 FOREIGN KEY(template_id, user_id) REFERENCES public.personnel_work_templates(id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.personnel_daily_work_logs TO authenticated;
GRANT ALL ON public.personnel_daily_work_logs TO service_role;
ALTER TABLE public.personnel_daily_work_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_staff_work_logs ON public.personnel_daily_work_logs FOR ALL TO authenticated
 USING (user_id = (SELECT auth.uid()) AND (public.has_role((SELECT auth.uid()), 'teacher') OR public.has_role((SELECT auth.uid()), 'admin') OR public.has_role((SELECT auth.uid()), 'director')) AND NOT public.has_role((SELECT auth.uid()), 'observer'))
 WITH CHECK (user_id = (SELECT auth.uid()) AND (public.has_role((SELECT auth.uid()), 'teacher') OR public.has_role((SELECT auth.uid()), 'admin') OR public.has_role((SELECT auth.uid()), 'director')) AND NOT public.has_role((SELECT auth.uid()), 'observer'));
CREATE FUNCTION public.validate_personnel_work_report() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 NEW.updated_at := now();
 IF TG_TABLE_NAME = 'personnel_work_templates' THEN
  IF btrim(NEW.title) = '' OR btrim(NEW.position_title) = '' OR cardinality(NEW.scopes) = 0 OR EXISTS (SELECT 1 FROM unnest(NEW.scopes) scope WHERE scope IS NULL OR btrim(scope) = '') THEN
   RAISE EXCEPTION 'Please define a title, position and nonempty work scopes';
  END IF;
 ELSE
  IF extract(isodow FROM NEW.work_date) IN (6,7) OR EXISTS (SELECT 1 FROM public.academic_events e WHERE e.event_type = 'holiday' AND e.event_date <= NEW.work_date AND coalesce(e.end_date,e.event_date) >= NEW.work_date) THEN
   RAISE EXCEPTION 'Daily work is not required on weekends or calendar holidays';
  END IF;
  IF NEW.work_date > (now() AT TIME ZONE 'Asia/Bangkok')::date THEN RAISE EXCEPTION 'Cannot record future work'; END IF;
  IF jsonb_typeof(NEW.items) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Work items must be an array'; END IF;
  IF jsonb_array_length(NEW.items) = 0 OR EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.items) item WHERE coalesce(btrim(item->>'scope'),'') = '' OR coalesce(btrim(item->>'detail'),'') = '') THEN
   RAISE EXCEPTION 'Work scopes and details are required';
  END IF;
  IF btrim(NEW.position_title) = '' THEN RAISE EXCEPTION 'Position is required'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_work_templates BEFORE INSERT OR UPDATE ON public.personnel_work_templates FOR EACH ROW EXECUTE FUNCTION public.validate_personnel_work_report();
CREATE TRIGGER validate_daily_work_logs BEFORE INSERT OR UPDATE ON public.personnel_daily_work_logs FOR EACH ROW EXECUTE FUNCTION public.validate_personnel_work_report();