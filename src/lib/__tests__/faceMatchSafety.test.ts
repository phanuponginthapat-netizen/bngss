// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { faceIdentityClear } from "../faceMatchSafety";
vi.mock("@vladmandic/face-api", () => ({
  SsdMobilenetv1Options: class {},
  TinyFaceDetectorOptions: class {},
}));
import { matchDescriptor } from "../faceApi";

const vector = (similarity: number) => [similarity, Math.sqrt(1 - similarity ** 2), ...Array(510).fill(0)];
describe("lookalike identity safety", () => {
  it("rejects close distinct identities despite a high winning confidence", () => {
    expect(faceIdentityClear("a", new Map([["a", .96], ["b", .87]]))).toBe(false);
  });
  it("accepts a clearly separated identity", () => {
    expect(faceIdentityClear("a", new Map([["a", .90], ["b", .65]]))).toBe(true);
  });
  it("does not let a rival's poor samples hide its close sample", () => {
    const result = matchDescriptor(vector(1), [
      { studentId: "a", descriptors: [vector(.93)] },
      { studentId: "b", descriptors: [vector(.90), vector(.1), vector(.1)] },
    ]);
    expect(result.studentId).toBeNull();
    expect(result.ambiguous).toBe(true);
  });
  it("compares people rather than two samples of the same person", () => {
    expect(matchDescriptor(vector(1), [{ studentId: "a", descriptors: [vector(.93), vector(.92)] }]).studentId).toBe("a");
  });
  it("rejects invalid scores instead of authorizing identity", () => {
    expect(faceIdentityClear("a", new Map([["a", .9], ["b", NaN]]))).toBe(false);
  });
});