-- ซ่อมการส่งสรุปการมาโรงเรียนเข้า LINE หลังย้าย workspace
-- ใช้เฉพาะ managed Cloud หลังติดตั้ง fix_workspace_cron_backend แล้ว
-- ห้ามเขียน URL หรือคีย์ของระบบเดิมกลับลง app_secrets
-- ตัวช่วยกลางตรวจสิทธิ์และใช้ปลายทางเดียวกับระบบปัจจุบัน
SELECT public.ensure_attendance_digest_cron();

-- ตรวจผล: SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE '%digest%';
--         SELECT id, status_code, left(content::text,200) FROM net._http_response ORDER BY id DESC LIMIT 5;
