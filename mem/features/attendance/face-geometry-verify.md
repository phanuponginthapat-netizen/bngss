---
name: Face geometry second-opinion (FaceGate v3.2)
description: กติกาการตรวจสัดส่วนโครงหน้าเสริม embedding ตอนสแกนใบหน้าเข้าโรงเรียน
type: feature
---
- ตัวประมวลผลเนทีฟ (`scripts/kiosk/facegate-agent/agent.py`) ส่ง `geometry` = 11 สัดส่วนจากจุดสังเกต 5 จุด หารด้วยระยะห่างตาสองข้าง (ไม่ขึ้นกับระยะ/ขนาดภาพ)
- `src/lib/faceGeometry.ts` — `geometryVerdict(live, stored, 0.55)`; ไม่มีข้อมูล = ผ่าน (ไม่เข้มขึ้นกับคนที่ยังไม่มี)
- สัดส่วนของแต่ละคนคำนวณในเครื่องจากภาพลงทะเบียน ใน `augmentCacheWithLocalEmbeddings` เก็บเป็น `geometries` ใน IndexedDB
- คีออสไม่บันทึกเมื่อเห็นหลายใบหน้าในเฟรมเดียว (`agentLastFaceCount() > 1`)
- `face_scan_logs.geometry_score` (0–1) และ `match_engine` บันทึกทุกครั้ง; รายงานรายวัน LINE แสดง "เนทีฟ %" และ "ตรงโครงหน้าเฉลี่ย %"
