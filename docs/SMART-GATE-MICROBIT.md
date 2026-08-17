# Smart Gate ด้วย micro:bit (ประตูอัตโนมัติ • วัดไข้ • ตรวจโลหะ)

ระบบคีออสสแกนใบหน้ารองรับอุปกรณ์ภายนอกผ่าน **Web Serial (USB)** หรือ **WebSocket gateway**

## โปรโตคอล (ข้อความบรรทัดละ 1 คำสั่ง, ปิดท้าย `\n`, baud 115200)

อุปกรณ์ → ระบบ
```
TEMP:37.8          # อุณหภูมิร่างกาย °C (เช่น MLX90614 / AMG8833)
METAL:640          # ค่าดิบเซนเซอร์โลหะ (หรือ METAL:ON / METAL:OFF)
GATE:OPEN|CLOSED   # สถานะประตู
{"temp":37.8,"metal":120,"gate":"closed"}   # ส่งเป็น JSON ก็ได้
```

ระบบ → อุปกรณ์
```
GATE:OPEN   GATE:CLOSE
BUZZ:OK     BUZZ:ALARM   BUZZ:FEVER
LED:GREEN   LED:RED
```

## ตัวอย่างโค้ด micro:bit (MakeCode / JavaScript)

```javascript
serial.redirectToUSB()
serial.setBaudRate(BaudRate.BaudRate115200)

basic.forever(function () {
    // อุณหภูมิจากเซนเซอร์อินฟราเรด (ต่อผ่าน I2C) — ตัวอย่างใช้ค่าอนาล็อก P1
    let t = pins.analogReadPin(AnalogPin.P1) * 0.05 + 30
    serial.writeLine("TEMP:" + t.toFixed(1))
    // เซนเซอร์โลหะ (inductive proximity) ต่อ P2
    serial.writeLine("METAL:" + pins.analogReadPin(AnalogPin.P2))
    basic.pause(1000)
})

serial.onDataReceived(serial.delimiters(Delimiters.NewLine), function () {
    let cmd = serial.readLine().trim()
    if (cmd == "GATE:OPEN") {
        pins.digitalWritePin(DigitalPin.P0, 1)   // รีเลย์ประตู
        serial.writeLine("GATE:OPEN")
    } else if (cmd == "GATE:CLOSE") {
        pins.digitalWritePin(DigitalPin.P0, 0)
        serial.writeLine("GATE:CLOSED")
    } else if (cmd.indexOf("BUZZ") == 0) {
        music.playTone(988, music.beat(BeatFraction.Half))
    } else if (cmd == "LED:RED") {
        basic.showIcon(IconNames.No)
    } else if (cmd == "LED:GREEN") {
        basic.showIcon(IconNames.Yes)
    }
})
```

## การใช้งานในระบบ
1. เปิดหน้าคีออสสแกนใบหน้า → ไอคอนตั้งค่า (มุมขวาบน)
2. ติ๊ก **Smart Gate** → เลือก USB (micro:bit) หรือ WebSocket
3. กด **เชื่อมต่ออุปกรณ์** (โหมด USB จะให้เลือกพอร์ต — ต้องใช้ Chrome/Edge บนคอมพิวเตอร์)
4. ตั้งเกณฑ์ไข้สูง (ค่าเริ่มต้น 37.5 °C) และเกณฑ์โลหะ (ค่าเริ่มต้น 600)

เมื่อสแกนใบหน้าผ่าน ระบบจะตรวจค่าล่าสุดจากเซนเซอร์ (อายุไม่เกิน 15 วินาที)
- ปกติ → สั่ง `GATE:OPEN` + เสียงเปิดประตู
- ไข้สูง → เสียงเตือนไข้ + เสียงพูดแจ้ง + ไม่เปิดประตู
- พบโลหะ → เสียงไซเรน + เสียงพูดแจ้ง + ไม่เปิดประตู

## เสียงในระบบคีออส
| เหตุการณ์ | เสียง | เสียงพูด (ถ้าเปิด face_scan_voice) |
|---|---|---|
| สแกนสำเร็จ | ding ขึ้นเสียงสูง | "สแกนเข้า/ออกสำเร็จ {ชื่อ}" |
| สแกนซ้ำ | บี๊ปต่ำสั้น | – |
| ใบหน้าไม่ได้ลงทะเบียน | บัซเซอร์ต่ำ 2 จังหวะ | "ไม่พบข้อมูลใบหน้าในระบบ กรุณาลงทะเบียน" |
| บุคลากรลงเวลา | ding | "ลงเวลาเข้างาน/ออกงาน {ชื่อ}" |
| ไข้สูง | เตือนสามจังหวะ | "ตรวจพบอุณหภูมิสูง …" |
| พบโลหะ | ไซเรนสั้น | "ตรวจพบวัตถุโลหะ …" |
| ประตูเปิด | โน้ตไล่ขึ้น 3 ตัว | – |
