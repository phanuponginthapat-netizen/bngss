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
});