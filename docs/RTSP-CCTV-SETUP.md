# RTSP / CCTV Camera Setup Guide

ระบบ Face Kiosk รองรับกล้อง IP / CCTV ผ่านโปรโตคอล **HLS (.m3u8)**, **MP4**, และ **WebM**

> ⚠️ เบราว์เซอร์ไม่สามารถเปิดสตรีม RTSP ได้โดยตรง  จำเป็นต้องใช้ **gateway** แปลง RTSP → HLS ก่อน

---

## ตัวเลือกที่ 1: MediaMTX (แนะนำ — ฟรี, รองรับหลายโปรโตคอล)

### 1. ติดตั้ง MediaMTX
```bash
# Docker (เร็วที่สุด)
docker run --rm -it \
  --network=host \
  -v $PWD/mediamtx.yml:/mediamtx.yml \
  bluenviron/mediamtx:latest
```

### 2. สร้างไฟล์ `mediamtx.yml`
```yaml
paths:
  cam1:
    source: rtsp://admin:password@192.168.1.100:554/Streaming/Channels/101
    sourceOnDemand: yes
  cam2:
    source: rtsp://admin:password@192.168.1.101:554/Streaming/Channels/101
    sourceOnDemand: yes

hls:
  enabled: yes
  address: :8888
  alwaysRemux: yes
  variant: lowLatency
  segmentCount: 3
  segmentDuration: 1s
```

### 3. ใส่ URL ในระบบ
ที่หน้า Face Kiosk → ⚙️ ตั้งค่า → CCTV → ใส่:
```
http://<server-ip>:8888/cam1/index.m3u8
```

---

## ตัวเลือกที่ 2: go2rtc (เบากว่า)

```bash
docker run -d --name go2rtc --network=host \
  -e CONFIG="streams:\n  cam1: rtsp://admin:pass@192.168.1.100:554/stream" \
  alexxit/go2rtc
```

URL: `http://<server-ip>:1984/api/stream.m3u8?src=cam1`

---

## ตัวเลือกที่ 3: ใช้กล้องที่รองรับ HLS โดยตรง

กล้องสมัยใหม่ (Hikvision, Dahua, Reolink รุ่นใหม่) บางรุ่นรองรับ HLS ในตัว — ดูคู่มือผู้ผลิต

---

## การตั้งค่าให้ระบบจับหลายใบหน้าได้แม่นยำ

1. **ความละเอียดกล้อง**: แนะนำ 1080p ขึ้นไป (มากกว่านี้กิน CPU)
2. **มุมกล้อง**: ติดสูง 2.0-2.5 ม. ก้มลง 15° เพื่อจับใบหน้าได้ตรง
3. **แสงสว่าง**: ≥ 200 lux, หลีกเลี่ยงแสงย้อน (backlight)
4. **เลือกโหมด "มุมกว้าง"** ในตั้งค่า → ใช้ inputSize 608 ตรวจจับได้พร้อมกัน 8-12 ใบหน้า
5. **GPU**: ถ้ามี dedicated GPU จะลด latency 3-5 เท่า

---

## CORS

ถ้า gateway ติด CORS error ให้เพิ่ม header นี้ใน MediaMTX:
```yaml
hls:
  serverHeader: |
    Access-Control-Allow-Origin: *
    Access-Control-Allow-Headers: *
```

หรือใช้ reverse proxy (nginx/Caddy) เพิ่ม CORS headers

---

## สรุปการรองรับในระบบ (อัปเดตล่าสุด)

| รูปแบบ | รองรับ | หมายเหตุ |
|---|---|---|
| HLS `.m3u8` | ✅ | ผ่าน hls.js (low-latency) + native HLS บน Safari/iOS |
| MP4 / WebM (progressive) | ✅ | ใส่ URL ตรงได้เลย |
| MJPEG (`/video.cgi`, `?action=stream`) | ✅ | กล้อง Axis / ESP32-CAM ฯลฯ |
| RTSP / RTSPS / RTMP | ❌ (บล็อกพร้อมคำแนะนำ) | เบราว์เซอร์เปิดตรงไม่ได้ ต้องผ่าน gateway |
| WebRTC / WHEP | ❌ (ยังไม่รองรับ) | ใช้ HLS จาก gateway เดียวกันแทน |

ความสามารถเสริมของหน้า Face Kiosk:
- ปุ่ม **ทดสอบการเชื่อมต่อ** ในหน้าตั้งค่า — ตรวจ HTTP status / playlist / CORS ก่อนเปิดกล้องจริง
- ตรวจจับ URL แบบ `rtsp://` แล้วแจ้งวิธีแก้ทันที (แทนที่จะค้างเป็นจอดำ)
- ตรวจ **mixed content** (หน้าเว็บ HTTPS + กล้อง HTTP) แล้วเตือนล่วงหน้า
- **กู้คืนอัตโนมัติ**: networkError → `startLoad()`, mediaError → `recoverMediaError()`
- **Watchdog ภาพค้าง**: ถ้าเฟรมไม่เดิน ~10 วินาที จะเชื่อมต่อใหม่ด้วย exponential backoff (สูงสุด 8 ครั้ง)
- ตั้ง `crossOrigin="anonymous"` เสมอ เพื่อให้ capture เฟรมลง canvas สำหรับตรวจใบหน้าได้ (gateway ต้องส่ง CORS header)

### ความแม่นยำ
การจดจำใบหน้าใช้ pipeline เดียวกับกล้อง USB (threshold ตั้งค่าได้จาก `face_scan_threshold`)
สตรีม HLS มี latency ~1.5–3 วินาที จึงเหมาะกับจุดเช็คอินที่ไม่ต้องการตอบสนองทันที
ถ้าต้องการเรียลไทม์ให้ใช้กล้อง USB ต่อกับเครื่องคีออสโดยตรง
