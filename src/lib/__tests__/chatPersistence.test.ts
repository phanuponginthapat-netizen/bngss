import { describe, expect, it, vi } from "vitest";
import { chatHistoryRows, durableChatContent } from "../../../supabase/functions/_shared/chatPersistence";

describe("durable AI output", () => {
  it("keeps all generated document text beyond 4000 characters", () => {
    const content = "ใบงาน".repeat(2000) + "จบเอกสาร";
    expect(chatHistoryRows("owner", "หัวข้อ", content, "model", null, 1000)[1].content).toBe(content);
  });
  it("stores complete illustration references rather than cut base64", async () => {
    const upload = vi.fn().mockResolvedValue("owner/image.png");
    expect(await durableChatContent("ต้น\n![ภาพ](data:image/png;base64,YWJj)\nท้าย", upload)).toBe("ต้น\n![ภาพ](ai-image://owner/image.png)\nท้าย");
    expect(upload).toHaveBeenCalledWith("image/png", "YWJj");
  });
  it("does not report saved output if image storage fails", async () => {
    await expect(durableChatContent("![ภาพ](data:image/png;base64,YWJj)", async () => { throw new Error("storage unavailable"); })).rejects.toThrow("storage unavailable");
  });
});