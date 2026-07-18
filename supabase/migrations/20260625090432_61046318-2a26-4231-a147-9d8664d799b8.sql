
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  v_today date := (now() AT TIME ZONE 'Asia/Bangkok')::date;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'director')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_build_object(
    'students_total', (SELECT count(*) FROM students WHERE status='active'),
    'students_male', (SELECT count(*) FROM students WHERE status='active' AND (gender IN ('ช','ชาย','male') OR replace(coalesce(prefix,''),' ','') IN ('ด.ช.','เด็กชาย','นาย','ดช','ดช.'))),
    'students_female', (SELECT count(*) FROM students WHERE status='active' AND (gender IN ('ญ','หญิง','female') OR replace(coalesce(prefix,''),' ','') IN ('ด.ญ.','เด็กหญิง','นาง','นางสาว','น.ส.','ดญ','ดญ.'))),
    'personnel_total', (SELECT count(*) FROM personnel),
    'personnel_linked', (SELECT count(*) FROM personnel WHERE user_id IS NOT NULL),
    'dept_data', (SELECT coalesce(jsonb_agg(jsonb_build_object('name', department, 'value', c)), '[]'::jsonb) FROM (SELECT department, count(*) c FROM personnel WHERE department IS NOT NULL GROUP BY department) d),
    'classrooms_total', (SELECT count(*) FROM classrooms),
    'classrooms_with_teacher', (SELECT count(*) FROM classrooms WHERE homeroom_teacher IS NOT NULL),
    'grade_data', (SELECT coalesce(jsonb_agg(jsonb_build_object('name', grade_level, 'value', c)), '[]'::jsonb) FROM (SELECT grade_level, count(*) c FROM classrooms WHERE grade_level IS NOT NULL GROUP BY grade_level) g),
    'subjects_total', (SELECT count(*) FROM subjects),
    'health_records_total', (SELECT count(*) FROM health_records),
    'pending_student_leaves', (SELECT count(*) FROM student_leaves WHERE status='pending'),
    'pending_staff_leaves', (SELECT count(*) FROM staff_leaves WHERE status='pending'),
    'pending_damage', (SELECT count(*) FROM asset_damage_reports WHERE status='pending'),
    'total_assets', (SELECT count(*) FROM assets),
    'damaged_assets', (SELECT count(*) FROM assets WHERE condition='ชำรุด'),
    'total_asset_value', (SELECT coalesce(sum(current_value),0) FROM assets),
    'positive_b', (SELECT count(*) FROM behavior_records WHERE behavior_type='positive'),
    'negative_b', (SELECT count(*) FROM behavior_records WHERE behavior_type='negative'),
    'sdq_count', (SELECT count(*) FROM sdq_records),
    'enrollments_active', (SELECT count(*) FROM enrollments WHERE status='active'),
    'homeroom_records_total', (SELECT count(*) FROM homeroom_records),
    'home_visits_total', (SELECT count(*) FROM home_visits),
    'total_documents', (SELECT count(*) FROM documents),
    'pending_docs', (SELECT count(*) FROM documents WHERE status='pending'),
    'income_total', (SELECT coalesce(sum(amount),0) FROM budget_transactions WHERE transaction_type='income'),
    'expense_total', (SELECT coalesce(sum(amount),0) FROM budget_transactions WHERE transaction_type='expense'),
    'budget_trend', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('month', month, 'income', income, 'expense', expense) ORDER BY month), '[]'::jsonb)
      FROM (
        SELECT to_char(transaction_date,'YYYY-MM') AS month,
               sum(CASE WHEN transaction_type='income' THEN amount ELSE 0 END) AS income,
               sum(CASE WHEN transaction_type='expense' THEN amount ELSE 0 END) AS expense
        FROM budget_transactions
        WHERE transaction_date >= (v_today - INTERVAL '6 months')
        GROUP BY 1
      ) bt
    ),
    'recent_news', (SELECT coalesce(jsonb_agg(row_to_json(n)), '[]'::jsonb) FROM (SELECT id, title, category, published_at, is_published FROM news_posts ORDER BY created_at DESC LIMIT 5) n),
    'upcoming_events', (SELECT coalesce(jsonb_agg(row_to_json(e)), '[]'::jsonb) FROM (SELECT * FROM academic_events WHERE event_date >= v_today ORDER BY event_date ASC LIMIT 5) e),
    'today_attendance', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('student_id', student_id, 'status', status)), '[]'::jsonb)
      FROM attendance WHERE attendance_date = v_today
    ),
    'today_face_scans', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('student_id', student_id, 'scan_time', scan_time)), '[]'::jsonb)
      FROM face_scan_logs WHERE scan_date = v_today
    ),
    'late_threshold', (
      SELECT coalesce(
        (SELECT setting_value FROM school_settings WHERE setting_key='face_scan_late_threshold' LIMIT 1),
        (SELECT setting_value FROM school_settings WHERE setting_key='clock_late_threshold' LIMIT 1),
        '08:30'
      )
    )
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_admin_dashboard_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_stats() TO authenticated, service_role;
