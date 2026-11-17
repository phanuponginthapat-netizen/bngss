// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isVisibleSchoolPersonnel } from "../personnelVisibility";

describe("school personnel presentation", () => {
  it("hides the scanner system account", () => {
    expect(isVisibleSchoolPersonnel({ first_name: "ตู้สแกนประตู", employee_code: "kiosk", department: "ระบบ" })).toBe(false);
  });
  it("hides the system observer shown in the supplied chart", () => {
    expect(isVisibleSchoolPersonnel({ first_name: "ผู้สังเกตการณ์", last_name: "ศึกษานิเทศก์", department: "หน่วยงานภายนอก" })).toBe(false);
  });
  it("keeps real external personnel and school staff", () => {
    expect(isVisibleSchoolPersonnel({ first_name: "สมชาย", last_name: "ใจดี", department: "หน่วยงานภายนอก", position_title: "ศึกษานิเทศก์" })).toBe(true);
    expect(isVisibleSchoolPersonnel({ first_name: "สมหญิง", department: "ฝ่ายวิชาการ" })).toBe(true);
  });
});