// @vitest-environment node
import { describe, expect, it } from "vitest";
import { exactStudentCode, rosterClassroomScope } from "../studentRosterFilter";

describe("behavior roster", () => {
  it("shows every server-authorized classroom in school scope even for a homeroom teacher", () => {
    expect(rosterClassroomScope(["room1"], "school")).toBeNull();
    expect(rosterClassroomScope([], "school")).toBeNull();
  });
  it("preserves other pages' default homeroom scope", () => {
    expect(rosterClassroomScope(["room1"])).toEqual(["room1"]);
  });
  it("selects an exact code from another room and clears an unmatched or empty code", () => {
    const students = [{ id: "first", student_code: "2539", classroom_id: "room1" }, { id: "second", student_code: "2540", classroom_id: "room2" }];
    expect(exactStudentCode(students, " 2540 ")?.id).toBe("second");
    expect(exactStudentCode(students, "254")).toBeNull();
    expect(exactStudentCode(students, "")).toBeNull();
  });
});