import { describe, expect, it, vi } from "vitest";

vi.mock("onnxruntime-web", () => ({ Tensor: class {}, InferenceSession: {}, env: { wasm: {} } }));
vi.mock("@/lib/arcface", () => ({ computeArcFaceEmbedding: vi.fn(), loadArcFace: vi.fn() }));

import { decodeScrfd } from "./onDeviceFace";

function emptyOutputs(size: number) {
  const outs: Float32Array[] = [];
  const counts = [8, 16, 32].map((s) => Math.ceil(size / s) ** 2 * 2);
  counts.forEach((n) => outs.push(new Float32Array(n)));
  counts.forEach((n) => outs.push(new Float32Array(n * 4)));
  counts.forEach((n) => outs.push(new Float32Array(n * 10)));
  return outs;
}

describe("SCRFD decoding (same as FaceGate PC)", () => {
  it("places a face at its grid cell and scales by stride", () => {
    const outs = emptyOutputs(320);
    // stride 16 grid is 20 wide; cell (x=5, y=3) → anchor index (3*20+5)*2
    const i = (3 * 20 + 5) * 2;
    outs[1][i] = 0.9;
    outs[4].set([2, 2, 2, 2], i * 4);
    const faces = decodeScrfd(outs, 320, 0.5);
    expect(faces).toHaveLength(1);
    expect(faces[0]).toMatchObject({ x1: 48, y1: 16, x2: 112, y2: 80 });
    expect(faces[0].kps[0]).toEqual([80, 48]);
  });

  it("ignores weak scores and merges duplicate anchors", () => {
    const outs = emptyOutputs(320);
    const i = (3 * 20 + 5) * 2;
    outs[1][i] = 0.9;
    outs[1][i + 1] = 0.8; // second anchor on the same cell
    outs[4].set([2, 2, 2, 2, 2, 2, 2, 2], i * 4);
    outs[0][10] = 0.3;
    expect(decodeScrfd(outs, 320, 0.5)).toHaveLength(1);
  });
});
