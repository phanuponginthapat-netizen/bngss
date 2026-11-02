import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";

// บันทึคการกรองทักทายของคำสั่งที่ส่งไปฐานขอมูล แยกตามตาราง
const h = vi.hoisted(() => {
  const filters: Array<{ table: string; key: string; value: unknown }> = [];
  const periods = [
    { academic_year_be: 2569, semester: 1, start_date: "2026-05-16", end_date: "2026-10-10" },
    { academic_year_be: 2569, semester: 2, start_date: "2026-11-02", end_date: "2027-03-31" },
  ];
  const makeBuilder = (table: string) => {
    const b: any = {
      select: () => b,
      order: () => b,
      or: () => b,
      in: () => b,
      gte: () => b,
      is: () => b,
      limit: () => b,
      eq: (key: string, value: unknown) => {
        filters.push({ table, key, value });
        return b;
      },
      then: (resolve: (v: { data: any[]; error: null }) => void) =>
        resolve({ data: [], error: null }),
    };
    return b;
  };
  return { filters, periods, makeBuilder };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => h.makeBuilder(table) },
}));
vi.mock("react-router-dom", () => ({ useNavigate: () => () => undefined }));
// วันวันนื้ = 2 พฤศจกายน 2569 ซึ่ งตรงกั บการเปิ ดภาคเรี ย น 2 ตามปฏิ ทิ นโรงเรี ย น
vi.mock("@/lib/dateBE", () => ({
  BE_OFFSET: 543,
  todayBangkok: () => "2026-11-02",
  bkkDateISO: () => "2026-11-02",
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: (opts: any) => {
    const key = Array.isArray(opts.queryKey) ? String(opts.queryKey[0]) : String(opts.queryKey);
    if (key === "semester-config") return { data: [], isLoading: false };
    if (key === "academic-periods") return { data: h.periods, isLoading: false };
    try {
      opts.queryFn?.();
    } catch {
      /* queryFn เป น async – ข้ อผิ ดพลาดไม่ เกี่ ยวข้ องกั บการตรวจ */
    }
    return { data: undefined, isLoading: true };
  },
}));

const { default: TeacherDailyBriefing } = await import("../TeacherDailyBriefing");

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

async function renderBriefing() {
  h.filters.length = 0;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      createElement(TeacherDailyBriefing, {
        userId: "user-1",
        personnelId: "personnel-1",
        personnelFullName: "นายทดสอบ คนทดสอบ",
        homeroomClassroomIds: [],
      }),
    );
    // ให ้คำสั่ งท ี่ก ำลั งร อเข ้าคิ วจ รง ๆ ส ิ้ นส ุ ดก่ อนปิ ดการเร นเดอร์
    await new Promise((r) => setTimeout(r, 50));
  });
  await act(async () => {
    root.unmount();
  });
  container.remove();
  return h.filters.filter((f) => f.table === "schedules");
}

describe("ตารางสอนในส่ว นสรุ ปภาระงานว ั นน ี้", () => {
  it("จัดข้ อมู ลให ้อยู ่ในภาคเรี ย นป ัจจุ บั นเท ่ าน ั้ น (ป ี CE 2026 ภาค 2)", async () => {
    const sched = await renderBriefing();
    expect(sched).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "academic_year", value: 2026 }),
        expect.objectContaining({ key: "semester", value: 2 }),
      ]),
    );
  });
});
