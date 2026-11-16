import { describe, it, expect } from "vitest";
import {
  computeIdPhotoCrop,
  ID_PHOTO_WIDTH,
  ID_PHOTO_HEIGHT,
  ID_FACE_HEIGHT_RATIO,
  ID_FACE_CENTER_Y_RATIO,
} from "../idPhotoCrop";

describe("computeIdPhotoCrop", () => {
  it("keeps the 413:531 card ratio and the face as large as the school card sample", () => {
    const c = computeIdPhotoCrop({ x: 900, y: 600, width: 300, height: 360 }, 2000, 3000);
    expect(c.width / c.height).toBeCloseTo(ID_PHOTO_WIDTH / ID_PHOTO_HEIGHT, 5);
    // ใบหน้า (คิ้ว-คาง) ต้องกินราว 43% ของความสูงรูปบัตร ตามต้วอย่างที่วัดจากบัตรจริง
    expect(ID_FACE_HEIGHT_RATIO).toBe(0.43);
    expect(360 / c.height).toBeCloseTo(ID_FACE_HEIGHT_RATIO, 5);
    // จุดกลางใบหน้าต้องอยู่ราว 51.5% จากขอบบน ไม่ใช่ 53% แบบเดิม
    expect(ID_FACE_CENTER_Y_RATIO).toBe(0.515);
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
});
