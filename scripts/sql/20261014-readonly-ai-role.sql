-- 20261014 — บัญชีอ่านอย่างเดียวสำหรับผู้ช่วยตรวจระบบ
-- ก่อนรัน: เปลี่ยน CHANGE_ME_STRONG_PASSWORD เป็นรหัสผ่านยาว ๆ ที่คุณตั้งเอง (อย่าส่งในแชท)
-- ยกเลิกได้ทุกเมื่อด้วย: DROP ROLE ai_readonly;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ai_readonly') THEN
    CREATE ROLE ai_readonly LOGIN PASSWORD 'CHANGE_ME_STRONG_PASSWORD';
  END IF;
END $$;

ALTER ROLE ai_readonly SET default_transaction_read_only = on;
ALTER ROLE ai_readonly SET statement_timeout = '30s';
ALTER ROLE ai_readonly CONNECTION LIMIT 3;
GRANT pg_read_all_data TO ai_readonly;   -- อ่านได้ทุกตาราง แก้/เพิ่ม/ลบไม่ได้
GRANT USAGE ON SCHEMA public, cron TO ai_readonly;
