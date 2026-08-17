-- 1) Add LINE slots and parent contact columns to students
DO $guard$
BEGIN
  EXECUTE 'ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS line_user_id_2 text,
  ADD COLUMN IF NOT EXISTS line_user_id_3 text,
  ADD COLUMN IF NOT EXISTS parent_name_1 text,
  ADD COLUMN IF NOT EXISTS parent_name_2 text,
  ADD COLUMN IF NOT EXISTS parent_name_3 text,
  ADD COLUMN IF NOT EXISTS parent_relation_1 text,
  ADD COLUMN IF NOT EXISTS parent_relation_2 text,
  ADD COLUMN IF NOT EXISTS parent_relation_3 text,
  ADD COLUMN IF NOT EXISTS parent_phone_1 text,
  ADD COLUMN IF NOT EXISTS parent_phone_2 text,
  ADD COLUMN IF NOT EXISTS parent_phone_3 text';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $idxguard$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_students_line_user_id_2 ON public.students(line_user_id_2) WHERE line_user_id_2 IS NOT NULL';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
DO $idxguard$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_students_line_user_id_3 ON public.students(line_user_id_3) WHERE line_user_id_3 IS NOT NULL';
EXCEPTION
  WHEN undefined_column OR undefined_table OR undefined_object OR duplicate_table THEN NULL;
END
$idxguard$;
-- 2) Drop all RLS policies that reference parent role or parent_student_links
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Parents can view linked student attendance" ON public.attendance';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Parents can view linked student behavior" ON public.behavior_records';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Parents view linked early_childhood_dev" ON public.early_childhood_dev';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "parents view child scan logs" ON public.face_scan_logs';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Parents can view linked student health records" ON public.health_records';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Parents can view linked student home visits" ON public.home_visits';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Loans viewable by staff student or personnel" ON public.ict_loans';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Parents can create links" ON public.parent_student_links';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Parents can view linked student sdq records" ON public.sdq_records';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Parents view linked student assessment scores" ON public.student_assessment_scores';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Parents view linked student column scores" ON public.student_column_scores';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Parents can create student leave" ON public.student_leaves';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Parents can view linked student leaves" ON public.student_leaves';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Parents view linked student scores" ON public.student_scores';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Parents view linked student screenings" ON public.student_screenings';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Parents can view linked student subsidies" ON public.student_subsidies';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Parents view linked subsidies" ON public.student_subsidies';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Parents can view linked students" ON public.students';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Parents view child vaccines" ON public.vaccine_records';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- Recreate ict_loans policy without parent_student_links reference
DO $guard$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Loans viewable by staff student or personnel" ON public.ict_loans';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'CREATE POLICY "Loans viewable by staff student or personnel"
ON public.ict_loans FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),''admin'')
  OR public.has_role(auth.uid(),''director'')
  OR public.has_role(auth.uid(),''teacher'')
  OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = ict_loans.student_id AND s.auth_user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.personnel p WHERE p.id = ict_loans.personnel_id AND p.user_id = auth.uid())
)';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- 3) Drop parent_student_links table
DROP TABLE IF EXISTS public.parent_student_links CASCADE;
-- 4) Delete any parent role assignments (data is empty but be safe)
DELETE FROM public.user_roles WHERE role = 'parent';
-- 5) Replace parent-notification triggers: send LINE directly to student's 3 LINE IDs
CREATE OR REPLACE FUNCTION public.send_line_to_student_parents(
  _student_id uuid, _title text, _message text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  ids text[];
  supabase_url text;
  service_key text;
BEGIN
  SELECT ARRAY(SELECT x FROM unnest(ARRAY[line_user_id, line_user_id_2, line_user_id_3]) x WHERE x IS NOT NULL AND x <> '')
    INTO ids FROM public.students WHERE id = _student_id;
  IF ids IS NULL OR array_length(ids,1) IS NULL THEN RETURN; END IF;

  supabase_url := current_setting('app.settings.supabase_url', true);
  service_key  := current_setting('app.settings.service_role_key', true);
  IF supabase_url IS NULL OR service_key IS NULL THEN RETURN; END IF;

  BEGIN
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/notify-line',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||service_key),
      body := jsonb_build_object(
        'message', COALESCE(_title,'') || E'\n' || COALESCE(_message,''),
        'title', _title,
        'line_user_ids', to_jsonb(ids),
        'severity', 'info'
      )
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;
DO $guard$
BEGIN
  EXECUTE 'REVOKE EXECUTE ON FUNCTION public.send_line_to_student_parents(uuid,text,text) FROM anon, authenticated, public';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
-- notify_parents_on_absence
CREATE OR REPLACE FUNCTION public.notify_parents_on_absence()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE student_name text;
BEGIN
  IF NEW.status = 'absent' THEN
    SELECT CONCAT(prefix, first_name, ' ', last_name) INTO student_name FROM public.students WHERE id = NEW.student_id;
    PERFORM public.send_line_to_student_parents(NEW.student_id, '📌 บุตรหลานขาดเรียน',
      COALESCE(student_name,'') || ' ขาดเรียนวันที่ ' || NEW.attendance_date);
  END IF;
  RETURN NEW;
END $$;
-- notify_parents_on_behavior
CREATE OR REPLACE FUNCTION public.notify_parents_on_behavior()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE student_name text; emoji text; type_label text;
BEGIN
  SELECT CONCAT(prefix, first_name, ' ', last_name) INTO student_name FROM public.students WHERE id = NEW.student_id;
  IF NEW.behavior_type = 'positive' THEN emoji := '⭐'; type_label := 'พฤติกรรมดี';
  ELSIF NEW.behavior_type = 'negative' THEN emoji := '⚠️'; type_label := 'พฤติกรรมที่ควรปรับปรุง';
  ELSE emoji := '📝'; type_label := 'บันทึกพฤติกรรม'; END IF;
  PERFORM public.send_line_to_student_parents(NEW.student_id,
    emoji || ' ' || type_label || ': ' || COALESCE(student_name,''),
    NEW.description || CASE WHEN COALESCE(NEW.points,0)<>0 THEN ' ('||NEW.points||' คะแนน)' ELSE '' END);
  RETURN NEW;
END $$;
-- notify_parents_on_score
CREATE OR REPLACE FUNCTION public.notify_parents_on_score()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE student_uuid uuid; student_name text; subj_name text; msg text;
BEGIN
  SELECT id, CONCAT(prefix, first_name, ' ', last_name) INTO student_uuid, student_name
    FROM public.students WHERE student_code = NEW.student_code LIMIT 1;
  IF student_uuid IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.grade IS NOT DISTINCT FROM OLD.grade AND NEW.total_score IS NOT DISTINCT FROM OLD.total_score THEN RETURN NEW; END IF;
  SELECT subject_name INTO subj_name FROM public.subjects WHERE id = NEW.subject_id;
  msg := 'วิชา '||COALESCE(subj_name,'-')||' • คะแนนรวม '||COALESCE(NEW.total_score::text,'-')||
         CASE WHEN NEW.grade IS NOT NULL THEN ' • เกรด '||NEW.grade ELSE '' END;
  PERFORM public.send_line_to_student_parents(student_uuid, '📊 ผลคะแนน: '||COALESCE(student_name,''), msg);
  RETURN NEW;
END $$;
-- notify_on_face_scan - keep teacher/admin notifications via notifications table, send LINE to all 3 slots
CREATE OR REPLACE FUNCTION public.notify_on_face_scan()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE student_name text; cls_id uuid; homeroom_name text; homeroom_uid uuid; scan_label text; msg_body text;
BEGIN
  SELECT CONCAT(prefix, first_name, ' ', last_name), classroom_id INTO student_name, cls_id
    FROM public.students WHERE id = NEW.student_id;
  scan_label := CASE NEW.scan_type
    WHEN 'entry' THEN '🚪 เข้าโรงเรียน' WHEN 'exit' THEN '🏃 ออกจากโรงเรียน'
    WHEN 'assembly' THEN '🇹🇭 เช็คชื่อหน้าเสาธง' ELSE '📷 สแกนหน้า' END;
  msg_body := COALESCE(student_name,'')||' เวลา '||to_char(NEW.scan_time AT TIME ZONE 'Asia/Bangkok','HH24:MI');

  PERFORM public.send_line_to_student_parents(NEW.student_id, scan_label, msg_body);

  IF cls_id IS NOT NULL THEN
    SELECT homeroom_teacher INTO homeroom_name FROM public.classrooms WHERE id = cls_id;
    IF homeroom_name IS NOT NULL THEN
      SELECT user_id INTO homeroom_uid FROM public.personnel
        WHERE CONCAT(prefix, first_name, ' ', last_name) = homeroom_name
           OR CONCAT(first_name, ' ', last_name) = homeroom_name LIMIT 1;
      IF homeroom_uid IS NOT NULL AND homeroom_uid <> COALESCE(NEW.scanned_by,'00000000-0000-0000-0000-000000000000'::uuid) THEN
        INSERT INTO public.notifications (user_id, title, message, type, reference_type, reference_id)
        VALUES (homeroom_uid, scan_label, msg_body, 'face_scan','face_scan_log', NEW.id);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;
-- 6) RPC: link a LINE userId into the next empty slot for a given student
CREATE OR REPLACE FUNCTION public.link_line_to_student_slot(_student_id uuid, _line_user_id text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s record; slot int := 0;
BEGIN
  SELECT line_user_id, line_user_id_2, line_user_id_3 INTO s FROM public.students WHERE id = _student_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'student not found'; END IF;
  IF s.line_user_id = _line_user_id OR s.line_user_id_2 = _line_user_id OR s.line_user_id_3 = _line_user_id THEN RETURN 0; END IF;
  IF s.line_user_id IS NULL OR s.line_user_id = '' THEN
    UPDATE public.students SET line_user_id = _line_user_id WHERE id = _student_id; slot := 1;
  ELSIF s.line_user_id_2 IS NULL OR s.line_user_id_2 = '' THEN
    UPDATE public.students SET line_user_id_2 = _line_user_id WHERE id = _student_id; slot := 2;
  ELSIF s.line_user_id_3 IS NULL OR s.line_user_id_3 = '' THEN
    UPDATE public.students SET line_user_id_3 = _line_user_id WHERE id = _student_id; slot := 3;
  ELSE RAISE EXCEPTION 'all 3 LINE slots are full for this student';
  END IF;
  RETURN slot;
END $$;
DO $guard$
BEGIN
  EXECUTE 'REVOKE EXECUTE ON FUNCTION public.link_line_to_student_slot(uuid,text) FROM anon, authenticated, public';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
