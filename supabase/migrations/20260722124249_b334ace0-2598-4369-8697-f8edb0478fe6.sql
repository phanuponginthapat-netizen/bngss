
REVOKE EXECUTE ON FUNCTION public.tg_auto_audit() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.prevent_student_code_self_edit() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.prevent_student_grade_tamper_homework() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.prevent_student_grade_tamper_task() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.queue_drive_file_deletion() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.trg_line_vault_staff_leave() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.trg_line_vault_student_leave() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.trg_line_vault_substitute() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.line_vault_dispatch(text, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.resolve_scanned_student(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_scanned_student(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.set_app_secret(text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.user_in_school_department(school_department) FROM PUBLIC, anon;
