## ขอบเขต

คุณเลือก "ทั้งหมด (ทำเป็นชุดใหญ่)" — ผมจะแบ่งเป็น 3 เฟส ทำต่อเนื่อง ไม่ต้องรออนุมัติระหว่างเฟส

### เฟส 1 — Security (บังคับ, ทำก่อน)
เปลี่ยน 3 storage bucket จาก public → private แล้วให้โค้ดเรียกผ่าน signed URL:
- `exam-scans` — ใบคำตอบสอบ (มีชื่อ/ลายมือนักเรียน)
- `pp5-files` — ไฟล์ ปพ.5 (เฉพาะครู/ผอ.)
- `wall-media` — สื่อบน wall ที่เป็น school/private

จุดที่ต้องแก้โค้ด: ที่ไหนที่ใช้ `getPublicUrl()` กับ 3 bucket นี้ จะเปลี่ยนเป็น `createSignedUrl(path, 3600)` และ cache 1 ชม.

### เฟส 2 — UI/UX Layer กลาง (กระทบทุกหน้า)
1. **Header/Layout** (`DashboardLayout.tsx`)
   - จัด spacing header ให้สม่ำเสมอ, ลด jitter บน mobile, safe-area สมบูรณ์
   - avatar+ชื่อ กด area ใหญ่ขึ้น 44×44
2. **PageHeader + SectionCard** (`components/shared/`)
   - เพิ่ม variant density (compact/default), skeleton state, breadcrumb slot
3. **EmptyState / StatCard** — เพิ่ม illustration slot, loading skeleton, error state
4. **Toast + Notification popup** — จัด z-index, animation smoother, dismiss gesture บน mobile
5. **Form primitives** — error message consistent, required indicator, focus ring
6. **Table wrapper** — sticky header, empty/loading/error state ครบ, horizontal scroll hint บน mobile

### เฟส 3 — หน้าหลักที่ผู้ใช้เจอบ่อย
1. Dashboard (Director/Teacher/Student) — grid responsive, card hierarchy, mobile stack
2. Inbox / Notifications — filter chips, group by date, read/unread affordance
3. Attendance (Face scan + manual) — camera framing, feedback states
4. Documents / E-Form — status badge สีสม่ำเสมอ, action bar sticky bottom บน mobile
5. Profile — tab overflow บน mobile, sticky sub-nav

## รายละเอียดทางเทคนิค

- ไม่เพิ่ม dependency ใหม่
- ใช้ design token (`--primary`, `--muted`, `--border`) เท่านั้น ห้าม hard-code สี
- ทุกจุด interactive ≥ 44×44 บน mobile
- ทุก loading ต้องมี skeleton (ไม่ใช้แค่ spinner)
- ทุก list ต้องมี empty state ที่ actionable

## ไม่ทำในรอบนี้
- ไม่ redesign brand/สี/ฟอนต์ (ยึด IBM Plex Sans Thai + gradient เดิมตาม memory)
- ไม่แตะ business logic / RLS / schema
- ไม่ทำหน้ารายงาน PDF (ใช้ TH Sarabun ตามมาตรฐาน ปพ.)

---

พร้อมเริ่มเฟส 1 ทันทีเมื่อคุณกด Approve ครับ ถ้าอยากตัดเฟสไหนออก บอกได้เลย
