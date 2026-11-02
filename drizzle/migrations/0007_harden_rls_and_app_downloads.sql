-- APK bucket: only the CI gateway (service role) may write/delete
DROP POLICY IF EXISTS app_downloads_ci_insert ON storage.objects;
DROP POLICY IF EXISTS app_downloads_ci_update ON storage.objects;
DROP POLICY IF EXISTS app_downloads_ci_delete ON storage.objects;

-- Signatures files: staff only
DROP POLICY IF EXISTS "signatures auth read" ON storage.objects;
CREATE POLICY "signatures staff read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'signatures' AND public.is_staff_any(auth.uid()));

-- Homework: students may not read classmates' submissions or set their own grades
DROP POLICY IF EXISTS "assignment owner can view submissions" ON public.homework_submissions;
CREATE POLICY "assignment owner can view submissions" ON public.homework_submissions FOR SELECT TO authenticated
  USING (public.is_staff_any(auth.uid()) AND EXISTS (SELECT 1 FROM public.homework_assignments a
    WHERE a.id = homework_submissions.assignment_id
      AND (a.created_by = auth.uid() OR a.school_id = public.get_user_school_id(auth.uid()))));

CREATE OR REPLACE FUNCTION public.guard_homework_grade_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_staff_any(auth.uid()) THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.score := NULL; NEW.final_score := NULL; NEW.feedback := NULL;
    NEW.graded_at := NULL; NEW.graded_by := NULL;
  ELSE
    NEW.score := OLD.score; NEW.final_score := OLD.final_score; NEW.feedback := OLD.feedback;
    NEW.graded_at := OLD.graded_at; NEW.graded_by := OLD.graded_by; NEW.auto_score := OLD.auto_score;
    NEW.field_results := OLD.field_results;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_homework_grade_fields ON public.homework_submissions;
CREATE TRIGGER trg_guard_homework_grade_fields BEFORE INSERT OR UPDATE ON public.homework_submissions
  FOR EACH ROW EXECUTE FUNCTION public.guard_homework_grade_fields();

-- Staff-only operational tables: replace "every signed-in user" reads with staff reads
DROP POLICY IF EXISTS "dir_sig read auth" ON public.director_signatures;
CREATE POLICY "dir_sig read staff" ON public.director_signatures FOR SELECT TO authenticated USING (public.is_staff_any(auth.uid()));
DROP POLICY IF EXISTS "duty_logs_select_auth" ON public.duty_logs;
CREATE POLICY "duty_logs_select_staff" ON public.duty_logs FOR SELECT TO authenticated USING (public.is_staff_any(auth.uid()));
DROP POLICY IF EXISTS "Devices viewable by authenticated" ON public.ict_devices;
CREATE POLICY "Devices viewable by staff" ON public.ict_devices FOR SELECT TO authenticated USING (public.is_staff_any(auth.uid()));
DROP POLICY IF EXISTS "Auth users can view school_milk_records" ON public.school_milk_records;
CREATE POLICY "Staff view school_milk_records" ON public.school_milk_records FOR SELECT TO authenticated USING (public.is_staff_any(auth.uid()));
DROP POLICY IF EXISTS "Auth users can view school_lunch_records" ON public.school_lunch_records;
CREATE POLICY "Staff view school_lunch_records" ON public.school_lunch_records FOR SELECT TO authenticated USING (public.is_staff_any(auth.uid()));
DROP POLICY IF EXISTS "All authenticated can read fill history" ON public.template_fill_history;
CREATE POLICY "Staff read fill history" ON public.template_fill_history FOR SELECT TO authenticated USING (public.is_staff_any(auth.uid()));
DROP POLICY IF EXISTS "vault_groups_read_authenticated" ON public.line_vault_groups;
CREATE POLICY "vault_groups_read_staff" ON public.line_vault_groups FOR SELECT TO authenticated USING (public.is_staff_any(auth.uid()));
DROP POLICY IF EXISTS "Authenticated users can view iot readings" ON public.iot_readings;
CREATE POLICY "Staff view iot readings" ON public.iot_readings FOR SELECT TO authenticated USING (public.is_staff_any(auth.uid()));
DROP POLICY IF EXISTS "vb_read_all" ON public.vehicle_bookings;
CREATE POLICY "vb_read_staff" ON public.vehicle_bookings FOR SELECT TO authenticated USING (public.is_staff_any(auth.uid()));
DROP POLICY IF EXISTS "rb_read_all" ON public.room_bookings;
CREATE POLICY "rb_read_staff" ON public.room_bookings FOR SELECT TO authenticated USING (public.is_staff_any(auth.uid()));