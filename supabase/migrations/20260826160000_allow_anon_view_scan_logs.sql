-- ให้ kiosk door ที่ยังไม่ login (anon) ก็เห็นสแกนล่าสุดได้เหมือนทุก platform
CREATE POLICY "anon can view scan logs"
ON public.face_scan_logs
FOR SELECT TO anon
USING (true);
