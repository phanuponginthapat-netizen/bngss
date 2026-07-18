---
name: CMS settings bulk loader
description: ทุก hook ที่อ่าน cms_settings ต้องผ่าน useCmsSettingsBulk() เพื่อกัน N+1
type: preference
---
- ห้าม query `.from("cms_settings").select(...)` ตรงๆ ใน hook/page ใหม่
- ใช้ `useCmsSettingsBulk()` / `useCmsValue(key)` / `useCmsValues(keys[])` จาก `@/hooks/useCmsSettings`
- bulk loader cache 10 นาที, invalidate อัตโนมัติเมื่อ cms_settings เปลี่ยน (useGlobalRealtime)
- **Why:** ก่อนหน้านี้ slow_queries เผยว่า cms_settings ถูก query 16,000+ ครั้ง (142s รวม) เพราะแต่ละ hook (useSystemSettings, useMascotSettings, useAiBotSettings, useIdCardSettings, useFieldVisibility, useSchoolReport ฯลฯ) ยิงเอง — ตอนนี้รวมเหลือ 1 call ต่อ session
- ถ้าต้องเพิ่ม CMS key ใหม่ → เพิ่ม selector ใน hook ที่ใช้, ไม่ใช่ query ใหม่
