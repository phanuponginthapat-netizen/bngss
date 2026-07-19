# Office Suite in ระบบ + Google Drive

สร้างชุดเครื่องมือทำเอกสารในเว็บ ใช้ Google Drive ของ user เป็น storage หลัก (บันทึก/เปิดจาก Drive ได้โดยตรง) รองรับฟอร์แมต Microsoft (.docx/.xlsx/.pptx) + PDF

## เมนูใหม่ (ใต้ sidebar หมวด "เครื่องมือ")
```
Office Suite
 ├─ 📝 เอกสาร (Docs)      → /office/docs
 ├─ 📊 ตารางคำนวณ (Sheets) → /office/sheets
 ├─ 🖼️ นำเสนอ (Slides)    → /office/slides
 ├─ 📄 PDF Tools          → /office/pdf
 └─ 📚 ไฟล์ล่าสุด          → /office (list จาก Drive)
```

## เทคโนโลยีที่จะใช้ (ทำงานฝั่ง client ล้วน)
- **Docs**: TipTap editor + `docx` (สร้าง .docx) + `mammoth` (อ่าน .docx → HTML)
- **Sheets**: **Univer** (open-source, UX เหมือน Excel, รองรับ .xlsx เต็มรูปแบบ) + `SheetJS/xlsx`
- **Slides**: `pptxgenjs` (สร้าง/บันทึก .pptx) + custom slide editor แบบง่าย (text box, image, shape) + preview ผ่าน canvas
- **PDF**: `pdf-lib` (แก้ไข/ใส่ข้อความ/ลายเซ็น/รวมหน้า) + `react-pdf` (viewer)
- **Liveworksheet-like**: ใช้โมดูล worksheets เดิมในระบบ (ที่มี worksheets/worksheet_submissions อยู่แล้ว)

## Google Drive Integration
ต่อยอด `/my-drive` และ `gdrive-proxy` edge function ที่มีอยู่:

| Action | วิธี |
|---|---|
| เปิดจาก Drive | `MyDrive` → คลิกไฟล์ .docx/.xlsx/.pptx/.pdf → เปิด editor ที่เหมาะสม |
| บันทึกใหม่ | Editor → "บันทึกไป Drive" → เลือกโฟลเดอร์ → upload ผ่าน `gdrive-proxy` (multipart) |
| บันทึกทับ | Editor → "บันทึก" → PATCH content ที่ fileId เดิม |
| Auto-save | ทุก 30 วิ ถ้ามี fileId อยู่แล้ว |

เพิ่ม endpoints ใน `gdrive-proxy`:
- `POST /upload` (multipart create หรือ update byte-content)
- `GET /download?fileId=...` (คืน ArrayBuffer)

## ไฟล์ใหม่
```
src/pages/office/
 ├─ OfficeHomePage.tsx         # เลือกโปรแกรม + ไฟล์ล่าสุดจาก Drive
 ├─ DocsEditorPage.tsx         # TipTap + import/export .docx
 ├─ SheetsEditorPage.tsx       # Univer + import/export .xlsx
 ├─ SlidesEditorPage.tsx       # slide list + canvas editor + .pptx export
 └─ PdfToolsPage.tsx           # viewer + text/signature/merge/split

src/lib/office/
 ├─ driveFileIO.ts             # openFromDrive / saveToDrive / pickFolder
 ├─ docxCodec.ts               # HTML↔docx (mammoth + docx)
 ├─ xlsxCodec.ts               # workbook↔xlsx (SheetJS)
 ├─ pptxCodec.ts               # slides JSON↔pptx (pptxgenjs)
 └─ pdfOps.ts                  # pdf-lib helpers
```

## รายละเอียดต่อโมดูล

### 1) Docs
- Toolbar: bold/italic/underline, heading, list, table, image, link, align
- Import: mammoth แปลง .docx → HTML → โหลดเข้า TipTap
- Export: TipTap JSON → `docx` library → Blob → upload Drive
- รองรับรูปที่ paste + heading styles + ตาราง

### 2) Sheets (Univer)
- ครบ formula, formatting, multi-sheet, chart พื้นฐาน
- Import/Export .xlsx ผ่าน SheetJS
- Freeze pane, filter, sort

### 3) Slides
- Layout: slide list ซ้าย + canvas กลาง + properties ขวา
- Elements: text, image (จาก Drive/upload), shape (rect/ellipse/line), background
- Templates: 5-6 template สำเร็จรูป (ธีมโรงเรียน)
- Export .pptx via pptxgenjs, preview slideshow แบบ fullscreen

### 4) PDF Tools
- Viewer (react-pdf, thumbnail sidebar)
- Actions: ใส่ข้อความบนหน้า, ใส่ลายเซ็นภาพ, วาดลายเซ็นด้วยเมาส์/tap, ไฮไลต์, รวม/แยกไฟล์, หมุนหน้า, ลบหน้า
- Save: pdf-lib serialize → upload Drive

## Database (เล็กน้อย)
เพิ่ม table `office_recent_files` เก็บ metadata ไฟล์ที่ user แก้ล่าสุด (ชื่อ, fileId, mimeType, opened_at) — เพื่อโชว์ "ล่าสุด" เร็ว ไม่ต้อง scan Drive ทุกครั้ง

## ขอบเขตที่ **ไม่รวม** ในรอบนี้ (จะทำเพิ่มภายหลัง)
- Real-time co-editing (หลายคนแก้พร้อมกัน) — Google Docs native ทำได้ ของเราต้องใช้ Yjs + ws server แยก
- Comments/track changes ระดับ Word
- Slides animation/transitions
- Print เข้าเครื่องพิมพ์โดยตรง (ใช้ browser print แทน)

## Dependencies ใหม่
`@tiptap/react @tiptap/starter-kit @tiptap/extension-image @tiptap/extension-table docx mammoth xlsx @univerjs/preset-sheets-core @univerjs/preset-sheets-core/locales pptxgenjs pdf-lib react-pdf`

## ขั้นตอนการ build
1. เพิ่ม endpoint upload/download ที่ `gdrive-proxy` + helper `driveFileIO.ts`
2. หน้า `OfficeHomePage` + route + เมนู sidebar
3. Docs editor (เบสิกก่อน แล้วเพิ่ม import/export)
4. Sheets editor (Univer)
5. Slides editor
6. PDF Tools
7. Recent files table + integration

Bundle จะใหญ่ขึ้นพอสมควร (~3-5 MB) — ใช้ **React.lazy** โหลด editor แต่ละตัวเฉพาะเวลาเปิดใช้

---
ยืนยันแผนนี้ไหมครับ ถ้าโอเคเดี๋ยวลุยตั้งแต่ขั้นตอนที่ 1
