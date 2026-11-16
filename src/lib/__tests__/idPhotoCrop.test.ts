import { describe, it, expect } from "vitest";
import {
  computeIdPhotoCrop,
  faceBoxFromLandmarks,
  ID_PHOTO_WIDTH,
  ID_PHOTO_HEIGHT,
  ID_FACE_HEIGHT_RATIO,
  ID_FACE_CENTER_Y_RATIO,
} from "../idPhotoCrop";

describe("computeIdPhotoCrop", () => {
  it("keeps the 413:531 card ratio and the face as large as the school card sample", () => {
    const c = computeIdPhotoCrop({ x: 900, y: 600, width: 300, height: 360 }, 2000, 3000);
    expect(c.width / c.height).toBeCloseTo(ID_PHOTO_WIDTH / ID_PHOTO_HEIGHT, 5);
    // รูปตัวอย่างทั้งสองวัดคิ้วถึงคางได้ 34–36% ของความสูง
    expect(ID_FACE_HEIGHT_RATIO).toBe(0.35);
    expect(360 / c.height).toBeCloseTo(ID_FACE_HEIGHT_RATIO, 5);
    // จุดกลางใบหน้าของรูปตัวอย่างทั้งสองอยู่ประมาณ 54.5% จากขอบบน
    expect(ID_FACE_CENTER_Y_RATIO).toBe(0.545);
    expect((780 - c.y) / c.height).toBeCloseTo(ID_FACE_CENTER_Y_RATIO, 5);
    expect(c.x + c.width / 2).toBeCloseTo(1050);
  });
  it("never leaves the source image", () => {
    const c = computeIdPhotoCrop({ x: 10, y: 5, width: 400, height: 500 }, 600, 700);
    expect(c.x).toBeGreaterThanOrEqual(0);
    expect(c.y).toBeGreaterThanOrEqual(0);
    expect(c.x + c.width).toBeLessThanOrEqual(600.0001);
    expect(c.y + c.height).toBeLessThanOrEqual(700.0001);
  });

  it("anchors the crop on brow-to-chin, not the detector box that includes the forehead", () => {
    const pts = Array.from({ length: 68 }, () => ({ x: 150, y: 150 }));
    // คิ้วบนสุด y=100, คาง (จุด 8) y=200, เค้าหน้ากวาง 80..220 → จุดกลาง x=150
    for (let i = 18; i < 28; i++) pts[i] = { x: 150, y: 100 };
    pts[8] = { x: 150, y: 200 };
    pts[1] = { x: 80, y: 150 };
    pts[15] = { x: 220, y: 150 };
    const box = faceBoxFromLandmarks(pts, { x: 60, y: 40, width: 180, height: 210 });
    expect(box.y).toBe(100);
    expect(box.height).toBe(100);
    expect(box.x + box.width / 2).toBe(150);
    // ตัดแล้วใบหน้าต้องกิน 35% ของความสูงรูปบัตร เท่าตัวอย่าง
    const crop = computeIdPhotoCrop(box, 2000, 3000);
    expect(box.height / crop.height).toBeCloseTo(ID_FACE_HEIGHT_RATIO, 5);
    expect((150 - crop.y) / crop.height).toBeCloseTo(ID_FACE_CENTER_Y_RATIO, 5);
  });

  it("falls back to the detector box when landmarks are missing or unusable", () => {
    const fb = { x: 60, y: 40, width: 180, height: 210 };
    expect(faceBoxFromLandmarks(undefined, fb)).toEqual(fb);
    expect(faceBoxFromLandmarks([], fb)).toEqual(fb);
    const bad = Array.from({ length: 68 }, () => ({ x: 150, y: 150 }));
    bad[8] = { x: 150, y: 100 }; // คางสูงกว่าคิ้ว → ใช้ไม่ได้
    expect(faceBoxFromLandmarks(bad, fb)).toEqual(fb);
  });
});
