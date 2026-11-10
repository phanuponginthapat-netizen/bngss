import { describe, expect, it } from "vitest";
import { readAiAttachment, validateAttachmentText } from "../aiAttachments";
describe("AI attachment source integrity", () => {
  it("retains the full provided content", async () => {
    const text = "เทอม 2 ปี 2569\nคะแนนรวม 83 เกรด 4";
    expect(await readAiAttachment({ name: "scores.csv", size: 100, text: async () => text } as File)).toEqual({ name: "scores.csv", text });
  });
  it("rejects empty extraction instead of pretending the document was read", () => {
    expect(() => validateAttachmentText("  ")).toThrow();
  });
  it("rejects excessive content instead of silently truncating", () => {
    expect(() => validateAttachmentText("ก".repeat(20001))).toThrow();
    expect(validateAttachmentText("ก".repeat(20000)).length).toBe(20000);
  });
});