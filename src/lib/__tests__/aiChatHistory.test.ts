import { describe, it, expect, vi } from "vitest";
const mock = vi.hoisted(() => ({ ranges: [] as number[][], fail: false }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => {
  const query = { select: () => query, eq: () => query, in: () => query, order: () => query,
    range: async (from: number, to: number) => {
      mock.ranges.push([from, to]);
      if (mock.fail && from === 500) return { data: null, error: new Error("read failed") };
      return { data: Array.from({ length: from === 0 ? 500 : 2 }, (_, i) => ({ id: String(from + i), role: "assistant", content: "งาน", created_at: "2026-11-11" })), error: null };
    } };
  return query;
} } }));
import { loadAiChatHistory } from "../aiChatHistory";
describe("complete AI chat history", () => {
  it("restores older works beyond the latest 40 and across pages", async () => {
    mock.ranges = []; mock.fail = false;
    const rows = await loadAiChatHistory("owner");
    expect(rows).toHaveLength(502);
    expect(mock.ranges).toEqual([[0, 499], [500, 999]]);
  });
  it("rejects incomplete history when a later page fails", async () => {
    mock.fail = true;
    await expect(loadAiChatHistory("owner")).rejects.toThrow("read failed");
    mock.fail = false;
  });
});