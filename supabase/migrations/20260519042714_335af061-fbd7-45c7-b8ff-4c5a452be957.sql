
-- Drop duplicate triggers (keep one of each pair)
DROP TRIGGER IF EXISTS trg_notify_absence ON public.attendance;
DROP TRIGGER IF EXISTS notify_negative_behavior ON public.behavior_records;
DROP TRIGGER IF EXISTS trg_notify_doc_reply ON public.document_recipients;
DROP TRIGGER IF EXISTS notify_document_created ON public.documents;
DROP TRIGGER IF EXISTS eform_recipients_notify ON public.eform_recipients;
DROP TRIGGER IF EXISTS eform_recipients_notify_sender ON public.eform_recipients;
DROP TRIGGER IF EXISTS eform_recipients_recompute ON public.eform_recipients;
DROP TRIGGER IF EXISTS trg_sync_notif_to_inbox ON public.notifications;
DROP TRIGGER IF EXISTS on_notification_send_push ON public.notifications;
DROP TRIGGER IF EXISTS trigger_auto_link_personnel ON public.profiles;
DROP TRIGGER IF EXISTS trg_auto_substitute ON public.staff_leaves;
DROP TRIGGER IF EXISTS notify_staff_leave ON public.staff_leaves;
DROP TRIGGER IF EXISTS notify_student_leave ON public.student_leaves;

-- Remove redundant legacy emergency trigger; notify_users_on_news handles emergency_broadcasts already
DROP TRIGGER IF EXISTS notify_emergency ON public.emergency_broadcasts;
