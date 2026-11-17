import { describe, expect, it } from "vitest";
import { flattenPortraitOnWhite } from "../idPhotoBackground";

describe("ID portrait background", () => {
  it("replaces the removed background with white while keeping opaque face/uniform pixels exact", () => {
    const input = new Uint8ClampedArray([81, 123, 167, 255, 20, 40, 60, 0]);
    expect(Array.from(flattenPortraitOnWhite(input))).toEqual([81, 123, 167, 255, 255, 255, 255, 255]);
    expect(Array.from(input)).toEqual([81, 123, 167, 255, 20, 40, 60, 0]);
  });
  it("retains soft hair edges instead of hard clipping the portrait matte", () => {
    expect(Array.from(flattenPortraitOnWhite(new Uint8ClampedArray([0, 0, 0, 128])))).toEqual([127, 127, 127, 255]);
  });
  it("rejects incomplete RGBA data", () => {
    expect(() => flattenPortraitOnWhite(new Uint8ClampedArray([1, 2, 3]))).toThrow();
  });
});