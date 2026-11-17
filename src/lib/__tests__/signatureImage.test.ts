import { describe, expect, it } from "vitest";
import { resolveDirectorSignature, transparentSignaturePixels } from "../signatureImage";

describe("director signature", () => {
  it("removes white paper without changing opaque black handwriting", () => {
    const input = new Uint8ClampedArray([255, 255, 255, 255, 20, 30, 40, 255]);
    expect(Array.from(transparentSignaturePixels(input))).toEqual([0, 0, 0, 0, 20, 30, 40, 255]);
    expect(input[3]).toBe(255);
  });
  it("keeps blue ink and soft stroke edges with transparency", () => {
    const result = transparentSignaturePixels(new Uint8ClampedArray([20, 60, 180, 255, 150, 150, 150, 255]));
    expect(Array.from(result.slice(0, 4))).toEqual([20, 60, 180, 255]);
    expect(result[7]).toBe(131);
    expect(result[4]).toBe(51);
  });
  it("never resurrects already transparent pixels", () => {
    expect(transparentSignaturePixels(new Uint8ClampedArray([0, 0, 0, 0]))[3]).toBe(0);
  });
  it("uses the CMS signature for cards and documents with legacy fallback", () => {
    expect(resolveDirectorSignature({ director_signature: "new.png", director_signature_url: "old.png" })).toBe("new.png");
    expect(resolveDirectorSignature({ director_signature_url: "legacy.png" })).toBe("legacy.png");
    expect(resolveDirectorSignature(null)).toBe("");
  });
});