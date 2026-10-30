// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useAcademicYear } from "../../hooks/useAcademicYear";

const state = vi.hoisted(() => ({
  today: "2026-11-01",
  settingsLoading: false,
  periodsLoading: false,
  settings: [] as { setting_key: string; setting_value: string }[],
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/dateBE", () => ({ BE_OFFSET: 543, todayBangkok: () => state.today }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => queryKey[0] === "semester-config"
    ? { data: state.settings, isLoading: state.settingsLoading }
    : { data: [
      { academic_year_be: 2569, semester: 1, start_date: "2026-05-16", end_date: "2026-10-10" },
      { academic_year_be: 2569, semester: 2, start_date: "2026-11-02", end_date: "2027-03-31" },
    ], isLoading: state.periodsLoading },
}));

function readHook() {
  let value: ReturnType<typeof useAcademicYear> | undefined;
  function Probe() { value = useAcademicYear(); return null; }
  renderToStaticMarkup(createElement(Probe));
  if (!value) throw new Error("Hook did not render");
  return value;
}

beforeEach(() => {
  state.today = "2026-11-01";
  state.settings = [];
  state.settingsLoading = false;
  state.periodsLoading = false;
});

describe("school term selection", () => {
  it("keeps semester 1 on 1 November 2569 despite the month fallback", () => {
    expect(readHook().currentSemester).toBe(1);
  });
  it("selects year 2569 semester 2 on 2 November", () => {
    state.today = "2026-11-02";
    const result = readHook();
    expect([result.currentAcademicYear, result.currentSemester]).toEqual([2569, 2]);
  });
  it("waits for the registered calendar", () => {
    state.periodsLoading = true;
    expect(readHook().isLoading).toBe(true);
  });
  it("waits for manual settings", () => {
    state.settingsLoading = true;
    expect(readHook().isLoading).toBe(true);
  });
  it("preserves explicitly selected year and semester", () => {
    state.settings = [
      { setting_key: "academic_year_override", setting_value: "2568" },
      { setting_key: "semester_override", setting_value: "2" },
    ];
    const result = readHook();
    expect([result.currentAcademicYear, result.currentSemester]).toEqual([2568, 2]);
  });
});