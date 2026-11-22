CREATE TABLE public.pp5_workbooks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 subject_id uuid NOT NULL REFERENCES public.subjects(id),
 classroom_id uuid NOT NULL REFERENCES public.classrooms(id),
 academic_year integer NOT NULL CHECK (academic_year BETWEEN 2000 AND 2400),
 semester integer NOT NULL CHECK (semester IN (1,2,3)),
 cells jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(cells)='object'),
 student_codes text[] NOT NULL DEFAULT '{}',
 revision integer NOT NULL DEFAULT 1,
 updated_by uuid NOT NULL DEFAULT auth.uid(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(subject_id,classroom_id,academic_year,semester)
);
GRANT SELECT,INSERT,UPDATE ON public.pp5_workbooks TO authenticated;
GRANT ALL ON public.pp5_workbooks TO service_role;
ALTER TABLE public.pp5_workbooks ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.can_edit_pp5_workbook(_subject uuid,_classroom uuid,_year integer,_semester integer) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR EXISTS (
 SELECT 1 FROM public.teacher_assignments a JOIN public.personnel p ON p.id=a.personnel_id
 WHERE p.user_id=auth.uid() AND a.subject_id=_subject AND a.classroom_id=_classroom AND a.academic_year=_year AND a.semester=_semester
 );
$$;
REVOKE ALL ON FUNCTION public.can_edit_pp5_workbook(uuid,uuid,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_edit_pp5_workbook(uuid,uuid,integer,integer) TO authenticated,service_role;
CREATE POLICY pp5_workbook_read ON public.pp5_workbooks FOR SELECT TO authenticated USING (public.can_edit_pp5_workbook(subject_id,classroom_id,academic_year,semester));
CREATE POLICY pp5_workbook_create ON public.pp5_workbooks FOR INSERT TO authenticated WITH CHECK (updated_by=auth.uid() AND public.can_edit_pp5_workbook(subject_id,classroom_id,academic_year,semester));
CREATE POLICY pp5_workbook_update ON public.pp5_workbooks FOR UPDATE TO authenticated USING (public.can_edit_pp5_workbook(subject_id,classroom_id,academic_year,semester)) WITH CHECK (updated_by=auth.uid() AND public.can_edit_pp5_workbook(subject_id,classroom_id,academic_year,semester));