// @vitest-environment node
import { describe, expect, it } from "vitest";
import { writeTaskJson } from "../taskJsonWrite";

describe("shared homework JSON writes", () => {
  it("re-reads after a collision and preserves another student's submission", async () => {
    let current: Record<string, unknown> = {};
    let calls = 0;
    await writeTaskJson("task", "submissions", value => ({ ...value, alice: { text: "A" } }), {
      read: async () => ({ value: current, error: null }),
      compareWrite: async (_id, _column, _expected, next) => {
        if (++calls === 1) { current = { bob: { text: "B" } }; return { data: [], error: null }; }
        current = next as Record<string, unknown>; return { data: [{ id: "task" }], error: null };
      },
    });
    expect(current).toEqual({ alice: { text: "A" }, bob: { text: "B" } });
  });
  it("preserves concurrent replies", async () => {
    let current: unknown[] = []; let calls = 0;
    await writeTaskJson("task", "replies", value => [...value as unknown[], "A"], {
      read: async () => ({ value: current, error: null }),
      compareWrite: async (_id, _column, _expected, next) => {
        if (++calls === 1) { current = ["B"]; return { data: [], error: null }; }
        current = next as unknown[]; return { data: [{ id: "task" }], error: null };
      },
    });
    expect(current).toEqual(["B", "A"]);
  });
  it("never treats persistent zero-row writes as success", async () => {
    await expect(writeTaskJson("task", "replies", value => value, {
      read: async () => ({ value: [], error: null }),
      compareWrite: async () => ({ data: [], error: null }),
    })).rejects.toThrow();
  });
  it("does not write when the source read fails", async () => {
    let writes = 0;
    await expect(writeTaskJson("task", "replies", value => value, {
      read: async () => ({ value: null, error: new Error("read failed") }),
      compareWrite: async () => { writes++; return { data: [], error: null }; },
    })).rejects.toThrow("read failed");
    expect(writes).toBe(0);
  });
});