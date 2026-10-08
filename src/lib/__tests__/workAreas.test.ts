import { describe, expect, it } from "vitest";
import { buildWorkAreas, visibleWorkAreas, findWorkArea, areaUrl } from "../navigation/workAreas";

describe("department navigation", () => {
  it("keeps PP and score tracking together", () => {
    const area = buildWorkAreas().find(a => a.key === "assessment");
    const urls = area?.groups.flatMap(g => g.items.map(i => i.url)) ?? [];
    for (const path of ["score-status", "pp5", "pp6", "transcript", "pp-docs", "grade-lock", "grade-remediation"]) expect(urls).toContain(`/dashboard/academic/${path}`);
  });
  it("hides staff-only departments from students and unresolved sessions", () => {
    const visible = visibleWorkAreas(buildWorkAreas(), "student", () => true);
    expect(visible.map(a => a.key)).not.toContain("assessment");
    expect(visible.map(a => a.key)).not.toContain("system");
    expect(visibleWorkAreas(buildWorkAreas(), null, () => true)).toEqual([]);
  });
  it("respects disabled modules and keeps teacher access unchanged", () => {
    const areas = visibleWorkAreas(buildWorkAreas(), "teacher", key => key !== "pp5");
    const urls = areas.flatMap(a => a.groups.flatMap(g => g.items.map(i => i.url)));
    expect(urls).not.toContain("/dashboard/academic/pp5");
    expect(urls).toContain("/dashboard/academic/score-status");
    expect(areas.map(a => a.key)).not.toContain("finance");
  });
  it("has no duplicate or unresolved task destinations", () => {
    for (const area of buildWorkAreas()) {
      const urls = area.groups.flatMap(g => g.items.map(i => i.url));
      expect(new Set(urls).size).toBe(urls.length);
      expect(urls.some(url => url.includes(":id"))).toBe(false);
    }
  });
  it("highlights the department from both main and child pages", () => {
    expect(findWorkArea(buildWorkAreas(), "/dashboard/academic/pp5")?.key).toBe("assessment");
    expect(findWorkArea(buildWorkAreas(), areaUrl("hr"))?.key).toBe("hr");
  });
  it("opens jobs directly for every non-academic department", () => {
    const required: Record<string, string[]> = {
      hr: ["hr/personnel", "hr/org-chart", "hr/time-clock", "hr/leave", "hr/substitute", "hr/salary", "hr/id-plan", "hr/evaluation", "hr/leave-balance"],
      finance: ["finance/budget", "finance/procurement", "finance/assets", "finance/assets/reports", "finance/subsidy"],
      general: ["admin/document", "admin/eform", "admin/news", "admin/school-milk", "projects/hub", "admin/print-center", "admin/smsc"],
      student: ["student/screening", "student/home-visit", "student/sdq", "student/health-trend", "admin/vaccine"],
    };
    for (const [key, paths] of Object.entries(required)) {
      const urls = buildWorkAreas().find(a => a.key === key)?.groups.flatMap(g => g.items.map(i => i.url));
      for (const path of paths) expect(urls).toContain(`/dashboard/${path}`);
    }
  });
  it("does not expose restricted personnel and finance jobs to teachers", () => {
    const areas = visibleWorkAreas(buildWorkAreas(), "teacher", () => true);
    const urls = areas.flatMap(a => a.groups.flatMap(g => g.items.map(i => i.url)));
    expect(urls).toContain("/dashboard/hr/substitute");
    expect(urls).toContain("/dashboard/admin/document");
    expect(urls).not.toContain("/dashboard/hr/salary");
    expect(urls).not.toContain("/dashboard/hr/personnel");
    expect(urls).not.toContain("/dashboard/finance/budget");
    expect(urls).not.toContain("/dashboard/admin/eform-templates");
  });
  it("honors switches on direct departmental jobs", () => {
    const areas = visibleWorkAreas(buildWorkAreas(), "admin", key => !["salary", "documents", "screening", "procurement"].includes(key ?? ""));
    const urls = areas.flatMap(a => a.groups.flatMap(g => g.items.map(i => i.url)));
    for (const path of ["hr/salary", "admin/document", "student/screening", "finance/procurement"]) expect(urls).not.toContain(`/dashboard/${path}`);
  });
});