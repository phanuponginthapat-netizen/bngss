# เร่งความเร็ว/ความแม่นยำ Kiosk Door (HP Pavilion x2)

ทำครบทุกข้อยกเว้นข้อ 5 (anti-spoofing เพิ่มเติม — ยังไม่ทำตามที่สั่ง)

## 1) Electron kiosk + COOP/COEP (WASM หลายเธรด)
- `electron/kiosk-main.cjs` — ใส่ header `Cross-Origin-Opener-Policy: same-origin` และ
  `Cross-Origin-Embedder-Policy: credentialless` ให้ทุก response → `crossOriginIsolated = true`
  → face-api / onnxruntime ใช้ WASM หลายเธรดได้ (เดิมถูกบังคับ 1 เธรด)
- เปิดสิทธิ์กล้อง/ไมค์อัตโนมัติ, autoplay ไม่ต้องกด, kiosk fullscreen, reload เองเมื่อ crash
- ติดตั้ง: `sudo bash scripts/kiosk/setup-electron-kiosk.sh "https://bngss.lovable.app/kiosk/door"`
  (ติดตั้ง Electron + systemd user service + ปรับกล้อง v4l2 ตอนบูต)
- ตรวจผล: `KIOSK_DEVTOOLS=1` แล้วพิมพ์ `crossOriginIsolated` ใน console ต้องได้ `true`

## 2) สแกนเฉพาะ ROI วงรี + detect rate 5–6 fps
- ROI วงรี/ติดตามใบหน้า ทำไว้แล้วใน `FaceKioskPage.tsx`
- `resolveLoopDelayMs()` ใน `src/lib/kioskPerf.ts` — เมื่อรันแบบ isolated (Electron)
  จะลดรอบตรวจเหลือ ~170–180 ms (≈5–6 fps) อัตโนมัติ; บนเบราว์เซอร์ปกติคงค่าเดิมกัน CPU ตัน

## 3) ปรับไดรเวอร์กล้อง (v4l2-ctl)
- `/usr/local/bin/kiosk-camera-tune.sh` ถูกติดตั้งโดยสคริปต์ข้อ 1 และรันก่อนเปิดแอปทุกครั้ง
- ปล่อย auto-exposure/auto-WB, ปิด backlight compensation, gain = 0 (ต้นเหตุภาพขาวโพลน)

## 4) ลงทะเบียนหลายมุม + หลายสภาพแสง
- มีอยู่แล้วใน `LivenessFaceRegisterDialog.tsx`: center 3 / near 2 / left 3 / right 3 ภาพ
  และสร้าง embedding เพิ่มในสภาพแสงต่าง ๆ (สว่างจ้า/มืด/โทนอุ่น/โทนเย็น) ก่อนบันทึก

## 6) Face sidecar (ONNX Runtime + OpenVINO บน Intel iGPU)
- เซิร์ฟเวอร์: `scripts/kiosk/face-sidecar/server.py` (`/health`, `/detect`, `/embed`)
- ติดตั้ง: `sudo bash scripts/kiosk/face-sidecar/install.sh` (systemd `kiosk-face-sidecar`, พอร์ต 8765, ฟังเฉพาะ localhost)
- ฝั่งเว็บ: `src/lib/faceSidecar.ts` ตรวจหาอัตโนมัติ; ถ้ามีจะให้ sidecar คัดกรองเฟรมว่างก่อน
  แล้วเบราว์เซอร์ประมวลผลเฉพาะเฟรมที่มีคนจริง — ลด CPU มากบนเครื่องสเปกเบา
- ปิดชั่วคราวได้: `localStorage.setItem("kiosk_face_sidecar_disabled","1")`
- ไม่มี sidecar = ทำงานเหมือนเดิมทุกประการ (fallback อัตโนมัติ)
