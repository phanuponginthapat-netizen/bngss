-- ฟังก์ชันแปลง พ.ศ. → ค.ศ. อัตโนมัติก่อน insert/update
CREATE OR REPLACE FUNCTION public.normalize_academic_year()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.academic_year IS NOT NULL AND NEW.academic_year > 2400 THEN
    NEW.academic_year := NEW.academic_year - 543;
  END IF;
  RETURN NEW;
END;
$$;
-- ติด trigger ทุกตารางที่มีคอลัมน์ academic_year
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'academic_events','action_plans','admissions','assessment_criteria',
    'attendance','classrooms','early_childhood_dev','enrollments',
    'homeroom_records','id_plan_records','pa_agreements','personnel_assessments',
    'pp5_files','pp6_files','schedules','school_lunch_records','school_milk_records',
    'school_test_scores','sdq_records','staff_evaluations','student_assessment_scores',
    'student_scores','student_screenings','student_subsidies','subjects','teacher_assignments'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_normalize_academic_year ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_normalize_academic_year
       BEFORE INSERT OR UPDATE OF academic_year ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.normalize_academic_year()',
      t
    );
  END LOOP;
END $$;
