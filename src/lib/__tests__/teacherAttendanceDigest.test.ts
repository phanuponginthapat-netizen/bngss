// @vitest-environment node
import { expect, it, vi } from "vitest";
import { deliverTeacherDigest, teacherDigestDue } from "../../../supabase/functions/_shared/teacherAttendanceDigest";
it("runs at Bangkok 10:00, not 09:59 or 10:20", () => {
  expect(teacherDigestDue(599)).toBe(false); expect(teacherDigestDue(600)).toBe(true); expect(teacherDigestDue(620)).toBe(false);
});
it("saves the identical full LINE summary for every teacher once per day", async () => {
  const rows = new Map<string, any>(); const summary = "✅ มา 157 คน\n❌ ขาด 11 คน\n▪️ ม.1\nรายชื่อครบ\n📅 กิจกรรม";
  const sb = { from: (table: string) => { const q: any = { select: () => q, eq: (_: string, role: string) => { expect(role).toBe("teacher"); return q; }, order: () => q,
    range: async () => ({ data: [{ user_id: "t1" }, { user_id: "t2" }], error: null }),
    insert: async (r: any) => { if(rows.has(r.id)) return { error: { code: "23505" } }; rows.set(r.id,r); return {error:null}; } }; return q; } };
  const push = vi.fn(async (_payload: any) => new Response("{}"));
  expect((await deliverTeacherDigest(sb,"2026-11-12",summary,push)).saved).toBe(2);
  expect([...rows.values()].map(r => r.message)).toEqual([summary, summary]);
  expect((await deliverTeacherDigest(sb,"2026-11-12",summary,push)).already_sent).toBe(2);
  expect(push).toHaveBeenCalledTimes(1); expect(push.mock.calls[0]?.[0]?.channels).toEqual(["push"]);
});