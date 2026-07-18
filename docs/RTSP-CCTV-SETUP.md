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
