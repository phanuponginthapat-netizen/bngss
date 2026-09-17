-- FaceGate v3.2 integration — บันทึกคุณภาพการจับคู่ใบหน้าไว้ในผลสแกน
-- geometry_score : ความเหมือนของสัดส่วนโครงหน้า (0–1) จากตัวประมวลผลเนทีฟ (NULL = ไม่มีข้อมูล)
-- match_engine   : เอนจินที่ใช้จับคู่ เช่น scrfd_500m+w600k_mbf (เนทีฟ) หรือ browser
-- รันซ้ำได้ปลอดภัย
alter table public.face_scan_logs add column if not exists geometry_score real;
alter table public.face_scan_logs add column if not exists match_engine text;

comment on column public.face_scan_logs.geometry_score is 'ความเหมือนสัดส่วนโครงหน้า 0-1 (NULL = ไม่มีข้อมูล)';
comment on column public.face_scan_logs.match_engine is 'เอนจินที่ใช้จับคู่ใบหน้า';

create index if not exists idx_face_scan_logs_engine on public.face_scan_logs (match_engine) where match_engine is not null;
