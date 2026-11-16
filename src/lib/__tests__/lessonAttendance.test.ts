// @vitest-environment node
import { describe, it, expect } from "vitest";
import { lessonStatusMap, countLessonStatuses, lessonReadStudentIds } from "../lessonAttendance";
describe("lesson attendance is separate from school arrival", () => {
  it("does not mark a lesson present from a school entry scan", () => {
    expect(lessonStatusMap([{student_id:"s",subject_id:null,period:0,status:"present"}],"math",2)).toEqual({});
  });
  it("preserves a missed lesson even if the student arrived at school", () => {
    expect(lessonStatusMap([{student_id:"s",subject_id:null,period:0,status:"present"},{student_id:"s",subject_id:"math",period:2,status:"absent"}],"math",2)).toEqual({s:"absent"});
  });
  it("does not reuse attendance from another period of the same subject", () => {
    expect(lessonStatusMap([{student_id:"s",subject_id:"math",period:1,status:"present"}],"math",2)).toEqual({});
  });
  it("counts a present and an absent lesson independently on the same day", () => {
    expect(countLessonStatuses([{student_id:"s",subject_id:null,status:"present"},{student_id:"s",subject_id:"math",status:"present",period:1},{student_id:"s",subject_id:"math",status:"absent",period:2}])).toEqual({present:1,absent:1,late:0,sick:0,leave:0,total:2});
  });
  it("does not restrict a lesson teacher to homeroom students", () => {
    expect(lessonReadStudentIds(false, false, [])).toBeNull();
  });
  it("restricts a parent to linked children", () => {
    expect(lessonReadStudentIds(true, false, ["child-1", "child-2"])).toEqual(["child-1", "child-2"]);
  });
  it("restricts a student to their own lesson records", () => {
    expect(lessonReadStudentIds(false, true, [], "student-1")).toEqual(["student-1"]);
  });
  it("does not read all students when a family link is missing", () => {
    expect(lessonReadStudentIds(true, false, [])).toEqual([]);
    expect(lessonReadStudentIds(false, true, [])).toEqual([]);
  });
});