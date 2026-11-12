// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const source = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[], error: null as unknown }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ select: (fields: string) => {
    const query = {
      order: () => query,
      range: async (from: number, to: number) => ({
        data: source.rows.slice(from, to + 1).map(row => fields === "*" ? row : { id: row.id }),
        error: source.error,
      }),
    };
    return query;
  } }) },
}));
import { loadFullClassrooms } from "../classroomQueries";

describe("complete shared classroom reads", () => {
  it("keeps the real year so ป.3 in 2569 remains selectable", async () => {
    source.error = null;
    source.rows = [{ id: "p3", grade_level: "ป.3", academic_year: 2026, homeroom_teacher_id: "teacher" }];
    const rooms = await loadFullClassrooms();
    expect(rooms.filter(r => r.academic_year === 2026 && r.grade_level === "ป.3").map(r => r.id)).toEqual(["p3"]);
    expect(rooms[0].homeroom_teacher_id).toBe("teacher");
  });
  it("does not turn failed reads into an empty classroom list", async () => {
    source.error = new Error("unavailable");
    await expect(loadFullClassrooms()).rejects.toThrow("unavailable");
    source.error = null;
  });
});