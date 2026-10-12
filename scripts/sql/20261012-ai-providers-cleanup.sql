-- 20261012 — จัดระเบียบผู้ให้บริการ AI
-- ปิด (ไม่ลบ) รายการที่ไม่มีคีย์ หรือเป็น Lovable AI (ใช้บนเซิร์ฟเวอร์โรงเรียนไม่ได้)
-- และอัปเดตรุ่น AI ที่กำลังเลิกให้บริการ รันซ้ำได้ ไม่ลบข้อมูล

-- 1) ปิดรายการที่ไม่มีคีย์ (ไม่มีคีย์ส่วนกลางสำรองในระบบเช่นกัน)
UPDATE public.ai_providers
SET enabled = false, notes = coalesce(notes,'') || ' [ปิดอัตโนมัติ 2026-10-12: ไม่มีคีย์]', updated_at = now()
WHERE enabled = true
  AND (provider_type = 'lovable' OR api_key IS NULL OR btrim(api_key) = '');

-- 2) อัปเดตรุ่นเก่า
UPDATE public.ai_providers SET model = 'gemini-2.5-flash', updated_at = now()
WHERE provider_type = 'gemini' AND model IN ('gemini-2.0-flash','gemini-1.5-flash');
UPDATE public.ai_providers SET model = 'google/gemini-2.5-flash', updated_at = now()
WHERE provider_type = 'openrouter' AND model IN ('google/gemini-2.0-flash-exp:free','google/gemini-flash-1.5-8b');

-- 3) เรียงลำดับตัวที่ใช้ได้จริง: Gemini ก่อน (อ่านรูป/ไฟล์ได้) → Groq → DeepSeek
UPDATE public.ai_providers SET priority = CASE provider_type
  WHEN 'gemini' THEN 1 WHEN 'groq' THEN 2 WHEN 'deepseek' THEN 3 ELSE priority END, updated_at = now()
WHERE enabled = true;

-- 4) ปลดคีย์ในคลังที่พ้นเวลาพักแล้ว
UPDATE public.ai_provider_keys SET status = 'active', cooldown_until = NULL
WHERE status = 'cooldown' AND cooldown_until < now();

SELECT name, provider_type, model, priority FROM public.ai_providers WHERE enabled ORDER BY priority;
