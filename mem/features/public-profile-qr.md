---
name: Public profile QR (PDPA-safe)
description: หน้าโปรไฟล์สาธารณะ /p/:id สแกน QR จากบัตรประจำตัว แสดงเฉพาะข้อมูลที่ไม่ขัด PDPA
type: feature
---
- Route: `/p/:id` → `src/pages/PublicProfilePage.tsx` (public, ไม่ต้อง login)
- ใช้ RPC `get_public_profile(_id uuid)` (SECURITY DEFINER) คืนเฉพาะ first/last/nickname, position_title, department, avatar_url, email, phone, school_name
- ไม่คืนวันเกิด, ที่อยู่, blood_type, emergency_*, line_id ฯลฯ
- ID Card QR (`qr_type === "profile"`) ชี้ไป `/p/:auth_user_id` แทน /dashboard/profile
- มี PDPA notice card อธิบายขอบเขตข้อมูลที่แสดง
