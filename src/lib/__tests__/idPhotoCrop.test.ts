import { describe, it, expect } from "vitest";
import { computeIdPhotoCrop, ID_PHOTO_WIDTH, ID_PHOTO_HEIGHT } from "../idPhotoCrop";

describe("computeIdPhotoCrop", () => {
  it("keeps the 413:531 card ratio and face at half height", () => {
    const c = computeIdPhotoCrop({ x: 900, y: 600, width: 300, height: 360 }, 2000, 3000);
    expect(c.width / c.height).toBeCloseTo(ID_PHOTO_WIDTH / ID_PHOTO_HEIGHT, 5);
    expect(c.height).toBeCloseTo(720);
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
