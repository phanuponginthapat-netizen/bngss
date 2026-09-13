# FaceGate Agent (BNGSS Kiosk)

ตัวประมวลผลใบหน้าแบบเนทีฟที่รันบน "เครื่องคีออส" คู่กับหน้าเว็บ `/face-kiosk`
ทำหน้าที่ตรวจจับใบหน้า (SCRFD `det_500m.onnx`) และคำนวณ embedding 512 มิติ
(ArcFace `w600k_mbf.onnx` — โมเดลตัวเดียวกับที่เว็บใช้) แทนการคำนวณในเบราว์เซอร์

* แม่นกว่า: จัดตำแหน่งใบหน้าจากจุดสังเกต 5 จุดจริงตามเทมเพลต ArcFace
* เร็วกว่า: onnxruntime เนทีฟ แทน WASM
* ปลอดภัย: ฟังเฉพาะ `127.0.0.1` ไม่ส่งภาพออกอินเทอร์เน็ต
* ไม่ต้องลงทะเบียนใบหน้าใหม่ เพราะเป็นโมเดลเดียวกัน

## ติดตั้ง

Linux / MX Linux:
```bash
bash scripts/kiosk/facegate-agent/install.sh
```

Windows (PowerShell แบบ Administrator):
```powershell
powershell -ExecutionPolicy Bypass -File scripts\kiosk\facegate-agent\install.ps1
```

ตัวติดตั้งจะสร้าง virtualenv, ติดตั้ง dependency, ดาวน์โหลดโมเดล และตั้งให้รันอัตโนมัติเมื่อเปิดเครื่อง

## Endpoint (พอร์ต 8899)

| Endpoint | ใช้ทำอะไร |
| --- | --- |
| `GET /health` | เช็คว่าพร้อมใช้งาน คืน `{ ok, engine, dim, detSize }` |
| `POST /detect` | ตรวจว่ามีใบหน้าในเฟรมหรือไม่ (คัดเฟรมว่าง) |
| `POST /scan` | body = JPEG → คืนกล่อง จุดสังเกต 5 จุด embedding 512 มิติ และค่าความสดของภาพ |
| `POST /embed` | body = `{ image: dataURL, crop }` → embedding สำหรับตอนลงทะเบียน |

## การใช้งานฝั่งเว็บ

หน้าเว็บจะตรวจหา agent เองอัตโนมัติ (`src/lib/faceAgent.ts`)
ถ้าไม่พบหรือ agent ล่ม จะกลับไปประมวลผลในเบราว์เซอร์ทันทีโดยไม่มีการสะดุด
ปิด/เปิดได้จากปุ่มตั้งค่าในหน้าคีออส (เก็บใน `localStorage.kiosk_face_agent_disabled`)
ถ้าต้องการชี้ไปเครื่องอื่น ตั้ง `localStorage.kiosk_face_agent_url`
