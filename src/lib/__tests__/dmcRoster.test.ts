import { describe, expect, it } from "vitest";
import { filterDmcStudents, loadDmcRows } from "../dmcRoster";

describe("complete DMC roster", () => {
  const students = Array.from({ length: 176 }, (_, i) => ({
    id: String(i), student_code: String(2500 + i), first_name: `ชื่อ${i}`, last_name: "ทดสอบ",
    status: i < 9 ? "inactive" : "active", classrooms: { grade_level: "ม.3" },
  }));
  it("reads every source page before filtering and counting", async () => {
    const rows = await loadDmcRows(async (from, to) => ({ data: students.slice(from, to + 1), error: null }), 50);
    const active = filterDmcStudents(rows, { search: "", grade: "all", status: "active", special: false });
    expect(rows).toHaveLength(176);
    expect(active).toHaveLength(167);
    expect(active.slice(150, 200)).toHaveLength(17);
  });
  it("finds a student beyond the first page, including full name search", () => {
    expect(filterDmcStudents(students, { search: "ชื่อ175 ทดสอบ", grade: "all", status: "active", special: false }).map(s => s.student_code)).toEqual(["2675"]);
  });
  it("does not return partial rows when a later source page fails", async () => {
    await expect(loadDmcRows(async from => from === 0 ? { data: students.slice(0, 50), error: null } : { data: null, error: new Error("offline") }, 50)).rejects.toThrow("offline");
  });
  it("keeps non-active historical students out of the current roster", () => {
    expect(filterDmcStudents(students, { search: "2500", grade: "all", status: "active", special: false })).toHaveLength(0);
    expect(filterDmcStudents(students, { search: "2500", grade: "all", status: "all", special: false })).toHaveLength(1);
  });
});