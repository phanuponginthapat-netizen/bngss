// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fillPaintRegion, paintHexColor } from "../worksheetPaint";

describe("worksheet paint", () => {
  it("fills only the connected region inside a drawn boundary", () => {
    const pixels = new Uint8ClampedArray(5 * 5 * 4);
    for (let y = 0; y < 5; y++) pixels.set([0, 0, 0, 255], (y * 5 + 2) * 4);
    expect(fillPaintRegion(pixels, 5, 5, 0, 2, [255, 0, 0, 255])).toBe(true);
    expect(Array.from(pixels.slice(40, 44))).toEqual([255, 0, 0, 255]);
    expect(Array.from(pixels.slice(48, 52))).toEqual([0, 0, 0, 255]);
    expect(Array.from(pixels.slice(56, 60))).toEqual([0, 0, 0, 0]);
  });
  it("fills transparent paper and terminates for an identical colour", () => {
    const pixels = new Uint8ClampedArray(4 * 4 * 4);
    expect(fillPaintRegion(pixels, 4, 4, 1, 1, [50, 100, 150, 255])).toBe(true);
    expect(Array.from(pixels.slice(60))).toEqual([50, 100, 150, 255]);
    expect(fillPaintRegion(pixels, 4, 4, 1, 1, [50, 100, 150, 255])).toBe(false);
  });
  it("rejects coordinates outside the drawing without touching pixels", () => {
    const pixels = new Uint8ClampedArray(16);
    expect(fillPaintRegion(pixels, 2, 2, -1, 0, [1, 2, 3, 255])).toBe(false);
    expect(pixels.every(v => v === 0)).toBe(true);
  });
  it("converts chosen colour and opacity to exact RGBA", () => {
    expect(paintHexColor("#ff8000", 50)).toEqual([255, 128, 0, 127]);
  });
});