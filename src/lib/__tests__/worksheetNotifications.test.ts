// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/notify", () => ({ notify: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { worksheetNotice } from "../worksheetNotifications";
describe("worksheet delivery", () => {
  it("uses homework delivery with the exact worksheet destination", () => {
    const notice = worksheetNotice("created", "worksheet-1", "งาน", ["student-a", "student-a"]);
    expect(notice.user_ids).toEqual(["student-a"]);
    expect(notice.reference_id).toBe("worksheet-1");
    expect(notice.reference_type).toBe("homework_assignments");
    expect(notice.url).toBe("/dashboard/homework?worksheet=worksheet-1");
    expect(notice.channels).toEqual(["in_app", "push", "line"]);
  });
  it("keeps submission and grading events distinct", () => {
    expect(worksheetNotice("submitted", "a", "งาน", ["teacher"]).type).toBe("homework_submitted");
    expect(worksheetNotice("graded", "a", "งาน", ["student"]).type).toBe("homework_graded");
  });
});