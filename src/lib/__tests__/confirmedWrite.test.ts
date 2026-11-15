// @vitest-environment node
import { describe, expect, it } from "vitest";
import { requireWrittenRows } from "../confirmedWrite";
describe("targeted writes never report empty success", () => {
  it("rejects zero affected rows", () => expect(() => requireWrittenRows({ data: [], error: null })).toThrow());
  it("rejects missing server confirmation", () => expect(() => requireWrittenRows({ data: null, error: null })).toThrow());
  it("preserves the source error", () => {
    const error = new Error("permission denied");
    expect(() => requireWrittenRows({ data: [{ id: "1" }], error })).toThrow(error);
  });
  it("accepts confirmed rows", () => expect(requireWrittenRows({ data: [{ id: "1" }], error: null })).toEqual([{ id: "1" }]));
});
