-- เก็บเฉพาะ "พาธ" ของรูปสแกนไวในฐานข้อมูล ไมเก็บลิงกชั่วคราวที่หมดอายุ
-- (คคาเก็บเป็น signed URL ไวว นกสแกนจะอานรูปไมไหลังลิงกหมดอายุ หรือหลงเปลี่ยน backend)
update public.kiosk_agent_alerts
   set snapshot_url = (regexp_match(snapshot_url, '/storage/v1/object/(?:public|sign|authenticated)/[^/]+/([^?#]+)'))[1]
 where snapshot_url ~ '/storage/v1/object/(?:public|sign|authenticated)/';

update public.face_scan_logs
   set captured_face_url = (regexp_match(captured_face_url, '/storage/v1/object/(?:public|sign|authenticated)/[^/]+/([^?#]+)'))[1]
 where captured_face_url ~ '/storage/v1/object/(?:public|sign|authenticated)/';